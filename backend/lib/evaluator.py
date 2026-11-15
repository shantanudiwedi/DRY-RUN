import json
import logging
import re
from typing import Optional, Tuple, List
from pydantic import BaseModel, Field
from lib.config import settings
from lib.models import RubricScores, ChatMessage

logger = logging.getLogger(__name__)


class EvaluationOutput(BaseModel):
    correctness: int = Field(ge=0, le=100)
    approach: int = Field(ge=0, le=100)
    complexity: int = Field(ge=0, le=100)
    edge_cases: int = Field(ge=0, le=100)
    communication: int = Field(ge=0, le=100)
    note: str
    is_vague: bool = False
    follow_up: Optional[str] = None


EVAL_SYSTEM_PROMPT = """You are an expert technical interviewer assessing a DSA viva answer for an Indian engineering student.
Your evaluation must be fair, calm, objective, and encouraging.
Evaluate the quality of the technical explanation only. NEVER judge accent, phrasing, or answer length.
Apply the following 0-100 rubric strictly:
1. correctness (0-100): Is the fundamental algorithmic/data structure concept accurate?
2. approach (0-100): Did the student identify the optimal approach or reasoning?
3. complexity (0-100): Did the student correctly mention time and space complexity if applicable?
4. edge_cases (0-100): Did the student account for constraints or boundary conditions?
5. communication (0-100): Was the explanation clear, logical, and structured?

Also determine:
- is_vague (boolean): Set to true ONLY if the answer is incomplete, superficial, or vague (e.g. 1 short sentence lacking core mechanics) so that a clarifying follow-up question is warranted.
- follow_up (string or null): If is_vague is true, provide a brief, targeted 1-sentence follow-up question. Otherwise null.
- note: A concise constructive summary of at most two sentences highlighting what was good and what could be improved.

Output ONLY valid JSON in this exact structure:
{
  "correctness": <int 0-100>,
  "approach": <int 0-100>,
  "complexity": <int 0-100>,
  "edge_cases": <int 0-100>,
  "communication": <int 0-100>,
  "note": "<string max 2 sentences>",
  "is_vague": <true/false>,
  "follow_up": <string or null>
}
"""


def fallback_evaluate(
    prompt: str, reference: str, answer: str
) -> Tuple[Optional[RubricScores], str, str, bool, Optional[str]]:
    """Honest fallback evaluation when LLMs are unavailable.
    Never returns invented numeric scores.
    """
    fu = "Could you elaborate on how your approach manages edge cases and asymptotic complexity?"
    return None, "AI evaluation unavailable", "fallback", False, fu


async def _call_groq(prompt_content: str) -> Optional[EvaluationOutput]:
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        for attempt in range(2):
            try:
                response = await client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": EVAL_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt_content},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )
                usage = response.usage
                if usage:
                    logger.info(
                        "Groq token usage: prompt=%s, completion=%s, total=%s",
                        usage.prompt_tokens,
                        usage.completion_tokens,
                        usage.total_tokens,
                    )
                raw = response.choices[0].message.content
                data = json.loads(raw)
                return EvaluationOutput(**data)
            except Exception as e:
                logger.warning("Groq evaluation attempt %d failed: %s", attempt + 1, e)
                if attempt == 1:
                    return None
    except Exception as e:
        logger.warning("Groq client setup failed: %s", e)
        return None
    return None


async def _call_gemini(prompt_content: str) -> Optional[EvaluationOutput]:
    if not settings.GEMINI_API_KEY:
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt_content,
                    config=types.GenerateContentConfig(
                        system_instruction=EVAL_SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    um = response.usage_metadata
                    logger.info(
                        "Gemini token usage: prompt=%s, candidates=%s, total=%s",
                        getattr(um, "prompt_token_count", 0),
                        getattr(um, "candidates_token_count", 0),
                        getattr(um, "total_token_count", 0),
                    )
                raw = response.text
                data = json.loads(raw)
                return EvaluationOutput(**data)
            except Exception as e:
                logger.warning("Gemini evaluation attempt %d failed: %s", attempt + 1, e)
                if attempt == 1:
                    return None
    except Exception as e:
        logger.warning("Gemini client setup failed: %s", e)
        return None
    return None


async def evaluate_answer(
    prompt: str, reference: str, answer: str
) -> Tuple[Optional[RubricScores], str, str, bool, Optional[str]]:
    """Evaluates student viva answer through Groq -> Gemini -> Fallback.
    Returns: (scores, note, source, is_vague, follow_up)
    """
    prompt_content = f"""QUESTION:
{prompt}

REFERENCE ANSWER:
{reference}

STUDENT'S ANSWER:
{answer}
"""
    # 1. Try Groq
    res = await _call_groq(prompt_content)
    if res:
        scores = RubricScores(
            correctness=res.correctness,
            approach=res.approach,
            complexity=res.complexity,
            edge_cases=res.edge_cases,
            communication=res.communication,
        )
        return scores, res.note, "llm", res.is_vague, res.follow_up

    # 2. Fallback to Gemini
    res = await _call_gemini(prompt_content)
    if res:
        scores = RubricScores(
            correctness=res.correctness,
            approach=res.approach,
            complexity=res.complexity,
            edge_cases=res.edge_cases,
            communication=res.communication,
        )
        return scores, res.note, "llm", res.is_vague, res.follow_up

    # 3. Honest deterministic offline fallback
    return fallback_evaluate(prompt, reference, answer)


async def generate_coach_note(
    topic: str,
    overall: Optional[int],
    dimensions: Optional[RubricScores],
    weak_topics: list[str]
) -> tuple[str, str]:
    """Generates personalized 2-sentence coach note via Gemini / Groq.
    Returns: (note_text, source)
    """
    if overall is None or dimensions is None:
        return "AI evaluation unavailable; no turns were scored in this session.", "fallback"

    prompt = f"""Generate a calm, encouraging, and constructive 2-sentence interview coach note for an Indian tech student.
Topic: {topic}
Overall Score: {overall}/100
Correctness: {dimensions.correctness}/100
Approach: {dimensions.approach}/100
Complexity: {dimensions.complexity}/100
Edge Cases: {dimensions.edge_cases}/100
Communication: {dimensions.communication}/100
Areas to strengthen: {', '.join(weak_topics) if weak_topics else 'None - strong across board'}

Write exactly 1 or 2 constructive sentences. No greetings or headers."""

    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            res = await client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            if res.text and len(res.text.strip()) > 10:
                return res.text.strip(), "llm"
        except Exception as e:
            logger.warning("Gemini coach note generation failed: %s", e)

    if settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            res = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
            )
            content = res.choices[0].message.content
            if content and len(content.strip()) > 10:
                return content.strip(), "llm"
        except Exception as e:
            logger.warning("Groq coach note generation failed: %s", e)

    # Deterministic fallback
    weak_str = f"especially {weak_topics[0].lower()}" if weak_topics else "boundary cases"
    fallback_note = f"Solid effort across the questions. Continue practicing your verbal reasoning, {weak_str}, to build full confidence for placement interviews."
    return fallback_note, "fallback"


class CodeReviewOutput(BaseModel):
    correctness: int = Field(ge=0, le=100)
    approach: int = Field(ge=0, le=100)
    complexity: int = Field(ge=0, le=100)
    edge_cases: int = Field(ge=0, le=100)
    communication: int = Field(ge=0, le=100)
    review_note: str
    follow_ups: list[str] = []


CODE_REVIEW_SYSTEM_PROMPT = """You are a senior technical interviewer reviewing code submitted by an engineering student in a mock DSA interview.
You must review the code WITHOUT executing it. NEVER claim or imply that the code was executed or run.
Analyze the source code's algorithmic approach, correctness, asymptotic complexity, and edge case handling.

Apply the following 0-100 rubric:
1. correctness (0-100): Is the logic correct? Will it produce valid output for general and edge test cases?
2. approach (0-100): Did the student choose the optimal algorithm or data structure?
3. complexity (0-100): What is the optimal time/space complexity, and does the code meet it?
4. edge_cases (0-100): Does the code gracefully handle constraints and boundary conditions?
5. communication (0-100): Code clarity, variable naming, readability, and structural cleanliness.

Generate 2 to 3 targeted follow-up viva questions specifically about THIS code implementation (e.g. asking why a certain data structure was chosen, the complexity of a specific loop, or what input might trigger an edge case).

Output ONLY valid JSON in this exact structure:
{
  "correctness": <int 0-100>,
  "approach": <int 0-100>,
  "complexity": <int 0-100>,
  "edge_cases": <int 0-100>,
  "communication": <int 0-100>,
  "review_note": "<string max 2 sentences>",
  "follow_ups": ["<question 1>", "<question 2>"]
}
"""


def fallback_code_review(
    prompt: str,
    language: str,
    code: str
) -> Tuple[Optional[RubricScores], str, str, list[str]]:
    """Honest deterministic fallback for code review when LLM is unavailable.
    Does NOT return invented numeric scores.
    """
    follow_ups = [
        f"What is the overall asymptotic time and auxiliary space complexity of your {language} solution?",
        "What edge cases (e.g. empty inputs or extreme constraint limits) could cause unexpected behavior in this implementation?"
    ]
    return None, "AI evaluation unavailable", "fallback", follow_ups


async def review_code(
    prompt: str,
    reference_answer: str,
    language: str,
    code: str,
) -> Tuple[Optional[RubricScores], str, str, list[str]]:
    """Reviews student code without executing it.
    Returns: (scores, review_note, source, follow_ups)
    """
    content = f"""PROBLEM STATEMENT:
{prompt}

REFERENCE SOLUTION IDEA:
{reference_answer}

LANGUAGE: {language}

SUBMITTED CODE:
```{language}
{code}
```
"""
    # 1. Try Groq
    if settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            for attempt in range(2):
                try:
                    response = await client.chat.completions.create(
                        model=settings.GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": CODE_REVIEW_SYSTEM_PROMPT},
                            {"role": "user", "content": content},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                    )
                    raw = response.choices[0].message.content
                    data = json.loads(raw)
                    out = CodeReviewOutput(**data)
                    scores = RubricScores(
                        correctness=out.correctness,
                        approach=out.approach,
                        complexity=out.complexity,
                        edge_cases=out.edge_cases,
                        communication=out.communication,
                    )
                    fu = out.follow_ups if len(out.follow_ups) >= 2 else [
                        "What is the time complexity of your primary logic?",
                        "How would you optimize the memory footprint?"
                    ]
                    return scores, out.review_note, "llm", fu[:3]
                except Exception as e:
                    logger.warning("Groq code review attempt %d failed: %s", attempt + 1, e)
        except Exception as e:
            logger.warning("Groq client setup failed for code review: %s", e)

    # 2. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            for attempt in range(2):
                try:
                    response = await client.aio.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=content,
                        config=types.GenerateContentConfig(
                            system_instruction=CODE_REVIEW_SYSTEM_PROMPT,
                            response_mime_type="application/json",
                            temperature=0.2,
                        ),
                    )
                    raw = response.text
                    data = json.loads(raw)
                    out = CodeReviewOutput(**data)
                    scores = RubricScores(
                        correctness=out.correctness,
                        approach=out.approach,
                        complexity=out.complexity,
                        edge_cases=out.edge_cases,
                        communication=out.communication,
                    )
                    fu = out.follow_ups if len(out.follow_ups) >= 2 else [
                        "What is the time complexity of your primary logic?",
                        "How would you optimize the memory footprint?"
                    ]
                    return scores, out.review_note, "llm", fu[:3]
                except Exception as e:
                    logger.warning("Gemini code review attempt %d failed: %s", attempt + 1, e)
        except Exception as e:
            logger.warning("Gemini client setup failed for code review: %s", e)

    # 3. Honest deterministic offline fallback
    return fallback_code_review(prompt, language, code)


TUTOR_SYSTEM_PROMPT = """You are a calm, encouraging DSA tutor assisting an Indian engineering college student who is preparing for technical interviews.
Follow these pedagogical rules strictly:
1. Provide concise, friendly guidance in 2-4 sentences. Keep replies short and focused.
2. If this is the start of the chat or the student says they are stuck: offer a conceptual hint or ask a guiding question to help them think in the right direction.
3. If the student has engaged with the hint or asks for a breakdown: give a clear step-by-step walkthrough of the approach.
4. Give the full solution or code ONLY if the student explicitly asks for it (e.g. "show me the solution", "give me the code", "what is the full answer?").
5. NEVER include any URLs, links, or web references under any circumstances.
"""


def fallback_tutor_chat(
    prompt: str, reference_answer: str, student_message: str
) -> Tuple[str, str]:
    """Fallback tutor reply when LLMs are unavailable. Never outputs URLs."""
    return "AI evaluation unavailable", "fallback"


async def tutor_chat(
    prompt: str,
    reference_answer: str,
    history: List[ChatMessage],
    student_message: str,
) -> Tuple[str, str]:
    """Socratic tutor chat.
    Returns: (reply_text, source)
    """
    clean_history = history[-6:] if history else []

    context_prompt = f"""PROBLEM CONTEXT:
Problem: {prompt}

Reference Solution Idea:
{reference_answer}
"""

    messages = [
        {"role": "system", "content": TUTOR_SYSTEM_PROMPT},
        {"role": "user", "content": context_prompt},
    ]

    for msg in clean_history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": student_message})

    # 1. Try Groq
    if settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            for attempt in range(2):
                try:
                    response = await client.chat.completions.create(
                        model=settings.GROQ_MODEL,
                        messages=messages,
                        temperature=0.3,
                        max_tokens=300,
                    )
                    reply = response.choices[0].message.content or ""
                    # Strip any URLs
                    reply = re.sub(r"https?://\S+", "", reply).strip()
                    if reply:
                        return reply, "llm"
                except Exception as e:
                    logger.warning("Groq tutor attempt %d failed: %s", attempt + 1, e)
        except Exception as e:
            logger.warning("Groq tutor setup failed: %s", e)

    # 2. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            for attempt in range(2):
                try:
                    contents = []
                    contents.append(f"{context_prompt}\n\nStudent: {student_message}")
                    response = await client.aio.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=TUTOR_SYSTEM_PROMPT,
                            temperature=0.3,
                            max_output_tokens=300,
                        ),
                    )
                    reply = response.text or ""
                    reply = re.sub(r"https?://\S+", "", reply).strip()
                    if reply:
                        return reply, "llm"
                except Exception as e:
                    logger.warning("Gemini tutor attempt %d failed: %s", attempt + 1, e)
        except Exception as e:
            logger.warning("Gemini tutor setup failed: %s", e)

    # 3. Honest deterministic offline fallback
    return fallback_tutor_chat(prompt, reference_answer, student_message)
