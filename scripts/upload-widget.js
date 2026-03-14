const el = {
  apiKey: document.getElementById('apiKey'),
  button: document.getElementById('uploadWidget'),
  status: document.getElementById('status'),
  video: document.getElementById('video'),
}

const app = {
  transcriptionURL: '',
  public_id: '',
  
  waitForTranscription: async () => {
    const maxAttempts = 30;
    const intervalInMs = 5000;

    if (!app.public_id) {
      throw new Error('public_id nao definido para buscar a transcricao.');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const version = `v${Date.now()}`;
      const transcriptionURL = `https://res.cloudinary.com/${config.cloudName}/raw/upload/${version}/${app.public_id}.transcript`;

      try {
        const response = await fetch(transcriptionURL, {
          cache: 'no-store',
        });

        if (response.ok) {
          app.transcriptionURL = transcriptionURL;
          console.log(`Transcricao encontrada na tentativa ${attempt}.`);
          console.log(`URL da transcricao: ${app.transcriptionURL}`);
          return true;
        }
      } catch (error) {
        console.error(`Tentativa ${attempt} falhou ao buscar a transcricao.`, error);
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalInMs));
      }
    }

    console.log('A transcricao nao ficou pronta apos 30 tentativas.');
    return false;
  },
  
  getTranscription: async () => {
    const response = await fetch(app.transcriptionURL);
    return response.text()
  },

  getViralMoment: async () => {
    const transcription = await app.getTranscription();

    const model = 'gemini-3-flash-preview';
    const endpointGemini = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const prompt = `
Role: You are a professional video editor specializing in viral content.
Task: Analyze the transcription below and identify the most engaging, funny, or surprising segment.
Constraints:
1. Duration: Minimum 30 seconds, Maximum 60 seconds.
2. Format: Return ONLY the start and end string for Cloudinary. Format: so_<start_seconds>,eo_<end_seconds>
3. Examples: "so_10,eo_20" or "so_12.5,eo_45.2"
4. CRITICAL: Do not use markdown, do not use quotes, do not explain. Return ONLY the raw string.

Transcription:
${transcription}
`;
    
    const headers = {
      'x-goog-api-key': el.apiKey.value,
      'Content-Type': 'application/json',
    };

    const contents = [
      {
        parts: [
          {
            text: prompt,
          }
        ]
      }
    ];

    const response = await fetch(endpointGemini, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents })
    });
    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    console.log('Resposta do Gemini: ', data);
    return rawText.replace(/```/g, '').replace(/json/g, "").trim();
  },
  
  getViralMomentTime: async () => {
    const maxRetries = 3;
    const baseDelayInMs = 1500;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await app.getViralMoment();
      } catch (error) {
        const isConnectionError =
          error instanceof TypeError ||
          /network|failed to fetch|fetch/i.test(error?.message || '');

        if (!isConnectionError || attempt === maxRetries) {
          console.log({ error });
          throw error;
        }

        const delayInMs = baseDelayInMs * attempt;
        console.warn(
          `Falha de conexao com o Gemini. Nova tentativa ${attempt + 1}/${maxRetries} em ${delayInMs}ms.`
        );

        await new Promise((resolve) => setTimeout(resolve, delayInMs));
      }
    }
  }
}

const config = {
  cloudName: 'difsq0sla',
  uploadPreset: 'nlw_clipmaker'
}

const myWidget = cloudinary.createUploadWidget(
  config,
  async (error, result) => {
    console.log('error: ', error); 
    if (!error && result && result.event === "success") { 
      console.log('Done! Here is the image info: ', result.info);
      app.public_id = result.info.public_id;
      
      try{
        const isReady = await app.waitForTranscription();
        
        if(!isReady) {
          throw new Error('Erro ao buscar a transcrição.');
        }

        const viralMoment = await app.getViralMomentTime();
        const viralMomentURL = `https://res.cloudinary.com/${config.cloudName}/video/upload/${viralMoment}/${app.public_id}.mp4`;
        // console.log('URL do momento viral: ', viralMomentURL);
        el.video.setAttribute('src', viralMomentURL);
      } catch(error){
        console.log({error});
      }
    }
  }
)

el.button.addEventListener("click", () =>{
  if(!el.apiKey.value) {
    alert('Por favor, insira sua chave de API do Gemini antes de fazer o upload do vídeo.');
    el.apiKey.focus();
    return;
  }
  myWidget.open();
}, false);