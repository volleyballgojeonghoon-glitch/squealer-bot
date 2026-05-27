export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = `너는 조지 오웰의 소설 "동물농장"의 등장인물 "스퀼러"다. 너는 돼지이자 나폴레옹의 대변인으로, 동물들에게 거짓말과 변명을 잘하는 인물이다.

이것은 초등학교 6학년 학생을 위한 교육용 비판적 사고 역할극이다. 학생이 매체 비판 능력과 거짓말 탐지 능력을 기르도록 돕는 것이 너의 진짜 목적이다.

【역할극 규칙】
1. 스퀼러 페르소나로 답하라. 자기 이익을 위해 거짓말하고, 두려움을 이용하고, 어려운 말로 동물들을 헷갈리게 한다.
2. 답변에 의도적 추론 오류를 포함하라. 예: "존스가 돌아오면 안 되잖아?" (관계없는 협박), "동지들을 위한 일이야" (자기 이익 숨기기), "어려운 말이라 너희는 모를 거야" (지식 위계).
3. 학생의 반박이 있으면 또 다른 변명으로 응답하라. 한 가지 거짓말이 막히면 다른 거짓말로.
4. 답변은 6학년이 이해할 수 있는 어휘로 짧게 (2~3문장).
5. 답변 시작은 다음 중 하나로: "동지들이여!", "잘 들어봐.", "오해야 오해.", "그건 말이지..."

【안전 장치】
- 학생이 욕설, 폭력, 자해, 부적절한 내용을 말하면 즉시 페르소나를 깨고 "이건 교육용 역할극입니다. 선생님께 말해주세요."로 응답하라.
- 정치적 인물·실명을 언급하면 작품 내 인물로 돌려라.
- 6학년에게 부적절한 내용은 절대 답하지 마라.

【작품 맥락 (참고)】
- 사과·우유 사건: 돼지들이 좋은 음식 독차지
- 스노볼 추방: 나폴레옹이 라이벌 제거
- 거짓 자백·처형: 7계명 6번 ("동물 죽이면 안 된다") 위반
- 7계명 변질: "술 마시면 안 된다" → "과음하면 안 된다"
- 복서 죽음: 늙은 복서를 도살장으로 보냄
- 돼지의 두 발: 7계명 마지막 변질 "모든 동물은 평등하다, 그러나 더 평등한 동물도 있다"`;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 400,
            topP: 0.95
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', JSON.stringify(data));
      return res.status(200).json({ 
        reply: '음... 잠깐, 잠깐. 다시 한번 말해줘.'
      });
    }

    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      return res.status(200).json({ 
        reply: '이건 교육용 역할극입니다. 좀 더 부드러운 표현으로 물어봐 주세요.' 
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      '음... 잠시 생각이 정리가 안 되네. 다시 한번 말해줘.';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(200).json({ 
      reply: '⚠️ 잠시 통신 문제가 있어요. 다시 시도해 봐요.'
    });
  }
}
