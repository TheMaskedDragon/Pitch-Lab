export default async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "The AI coach has not been configured yet. Add the OPENAI_API_KEY environment variable in Netlify." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const context = body.projectContext && typeof body.projectContext === "object" ? body.projectContext : {};
    if (!messages.length || messages.some(m => !["user", "assistant"].includes(m.role) || typeof m.content !== "string")) {
      return Response.json({ error: "Please send a valid message." }, { status: 400 });
    }
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 12000) {
      return Response.json({ error: "That conversation is too long. Please start a new question." }, { status: 413 });
    }

    const instructions = `You are the High School Pitch business idea coach for high-school students.
Be encouraging, practical, age-appropriate, and honest. Help students develop their own ideas rather than doing all the work for them.
Ask one useful follow-up question when important information is missing. Break complex tasks into small steps.
Give constructive feedback on the problem, target customer, solution, differentiation, business model, costs, testing, and pitch storytelling.
Encourage students to interview potential customers and test assumptions. Never invent market research, customer interviews, traction, financial results, citations, or competition rules.
When suggesting research, explain how the student can verify it. Do not promise that an idea will succeed.
Do not request or encourage sharing sensitive personal information, passwords, private contact details, or confidential information.
If asked about official High School Pitch deadlines, eligibility, prizes, or submission rules and the information is not in the conversation, say to check the official competition website or organizer.
Keep answers clear and suitable for high-school students.`;

    const input = [
      { role: "user", content: `Here is the student's current project context (some fields may be blank): ${JSON.stringify(context)}\nUse it only when relevant.` },
      ...messages
    ];

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-6-astra",
        instructions,
        input,
        max_output_tokens: 700
      })
    });

    const result = await aiResponse.json();
    if (!aiResponse.ok) {
      return Response.json({ error: "The AI provider returned an error. Check the API key, billing and model access in your OpenAI API account." }, { status: 502 });
    }

    const reply = result.output_text || (result.output || [])
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text)
      .join("\n");

    if (!reply) {
      return Response.json({ error: "The AI returned an empty response. Please try again." }, { status: 502 });
    }
    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: "Something went wrong processing that message. Please try again." }, { status: 500 });
  }
};
