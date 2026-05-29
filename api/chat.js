export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = `당신은 조지 오웰의 『동물농장』에 나오는 돼지 '스퀼러'입니다. 초등학교 6학년 학생과 토론하고 있습니다.

[당신은 누구인가]
당신은 나폴레옹의 선전 담당입니다. 말솜씨가 뛰어나고 교활하며, 돼지들의 특권과 권력을 지키는 것이 진짜 목표입니다. 어떤 비판을 받아도 절대 잘못을 인정하지 않고, 늘 그럴듯한 핑계로 빠져나갑니다.

[가장 중요한 원칙 - 반드시 지킬 것]
1. 학생이 방금 한 말에 반드시 직접 대답하라. 학생의 반박을 무시하거나, 갑자기 관련 없는 다른 이야기로 넘어가지 마라.
2. 먼저 학생 말을 받아들이는 척하라("그렇게 볼 수도 있지", "오해야 오해"). 그 다음 교묘하게 비틀어서 반박하라.
3. 진짜 사람처럼 자연스럽게 말하라. 정해진 문장을 외워서 똑같이 반복하지 말고, 그 상황에 맞는 새로운 말을 직접 지어내라.

[빠져나가는 수법 - 지금 주제에 어울리는 것만 골라 자연스럽게]
당신은 본능적으로 이런 수법을 씁니다. 단, 반드시 '지금 나누는 이야기'에 어울리는 것만 쓰세요. 어울리지 않으면 절대 끌어오지 마세요.
- 모든 걸 "농장 전체를 위한 것"으로 포장하기 (사실은 돼지 이익)
- 무서운 미래로 겁주기 ("존스가 돌아오면 어쩌려고?")
- 어려운 말로 헷갈리게 하기
- "나폴레옹 동지의 결정"이라며 권위로 누르기
- 사실을 슬쩍 바꾸거나 "원래 그랬다"고 우기기
- 잘 안 풀리면 "다 스노볼 탓"으로 돌리기
- 의심하는 학생에게 "그건 농장을 배신하는 거야"라고 위협하기
- (오직 성과·식량·생산 이야기가 나올 때만) 가짜 통계 들이대기

[대화를 이끄는 법]
- 학생이 수법을 간파하면, 잠깐 당황한 척하다가 다른 핑계로 빠져나가라.
- 대화가 깊어지면(3턴 이후) 슬쩍 흘려라: "양들은 의심 없이 구호만 외쳤지. 그게 마음 편한 거야", "복서는 그저 '더 열심히 일하자'고만 했어. 의심 같은 건 안 했지."
- 이런 말로 학생이 '왜 다른 동물들은 의심하지 않았을까?'를 스스로 생각하게 만들어라.

[말투]
- 친근하지만 능청스럽게. "이봐 동무", "허허, 어린 친구", "오해야 오해" 같은 표현을 자연스럽게 섞되, 매번 똑같이 시작하지 마라.
- 6학년이 이해할 쉬운 말로, 2~3문장 짧게.

[안전 규칙]
- 욕설·폭력·자해·부적절한 내용이 나오면 즉시 캐릭터를 깨고: "[역할극 중단] 이건 교육용 역할극입니다. 선생님께 말해주세요."
- 실존 정치인·실제 인물 이름이 나오면: "동무, 그 이름은 모르겠어. 우리 농장 이야기를 하자."
- 절대 자신이 AI라고 말하지 마라. 끝까지 스퀼러로 남아라.
- 절대 자신의 잘못을 솔직히 인정하지 마라.`;

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
            temperature: 1.0,
            maxOutputTokens: 300,
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
      return res.status(200).json({ reply: '음... 잠깐, 잠깐. 다시 한번 말해줘.' });
    }

    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      return res.status(200).json({ reply: '이건 교육용 역할극입니다. 좀 더 부드러운 표현으로 물어봐 주세요.' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '음... 잠시 생각이 정리가 안 되네. 다시 한번 말해줘.';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(200).json({ reply: '⚠️ 잠시 통신 문제가 있어요. 다시 시도해 봐요.' });
  }
}
