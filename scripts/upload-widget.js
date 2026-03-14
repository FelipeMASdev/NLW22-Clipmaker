const el = {
  apiKey: document.getElementById('apiKey'),
  button: document.getElementById('uploadWidget'),
  downloadButton: document.getElementById('downloadViral'),
  status: document.getElementById('status'),
  video: document.getElementById('video'),
}

const statusStyles = ['status-info', 'status-success', 'status-warning', 'status-error'];

const ui = {
  setStatus: (message, variant = 'info') => {
    el.status.textContent = message;
    el.status.classList.remove(...statusStyles);

    const styleByVariant = {
      info: 'status-info',
      success: 'status-success',
      warning: 'status-warning',
      error: 'status-error',
    };

    el.status.classList.add(styleByVariant[variant] || styleByVariant.info);
  },

  setButtonState: (isLoading, text) => {
    el.button.disabled = isLoading;
    el.button.textContent = text;
    el.button.classList.toggle('opacity-70', isLoading);
    el.button.classList.toggle('cursor-not-allowed', isLoading);
  },

  setDownloadButtonState: (isEnabled) => {
    el.downloadButton.disabled = !isEnabled;
  },

  downloadViralVideo: async () => {
    if (!app.viralMomentURL) {
      ui.setStatus('O video ainda nao foi gerado para download.', 'warning');
      return;
    }

    try {
      ui.setStatus('Preparando download do video viral...', 'info');
      const response = await fetch(app.viralMomentURL);

      if (!response.ok) {
        throw new Error(`Erro no download: ${response.status}`);
      }

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');

      tempLink.href = objectURL;
      tempLink.download = `${app.public_id || 'viral-moment'}.mp4`;
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
      URL.revokeObjectURL(objectURL);

      ui.setStatus('Download iniciado com sucesso.', 'success');
    } catch (error) {
      console.log({ error });
      window.open(app.viralMomentURL, '_blank', 'noopener,noreferrer');
      ui.setStatus('Nao foi possivel baixar diretamente. A URL foi aberta em nova aba.', 'warning');
    }
  }
};

const app = {
  transcriptionURL: '',
  public_id: '',
  viralMomentURL: '',
  
  waitForTranscription: async () => {
    const maxAttempts = 30;
    const intervalInMs = 5000;

    if (!app.public_id) {
      throw new Error('public_id nao definido para buscar a transcricao.');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const version = `v${Date.now()}`;
      const transcriptionURL = `https://res.cloudinary.com/${config.cloudName}/raw/upload/${version}/${app.public_id}.transcript`;

      ui.setStatus(`Aguardando transcricao... tentativa ${attempt}/${maxAttempts}.`, 'info');

      try {
        const response = await fetch(transcriptionURL, {
          cache: 'no-store',
        });

        if (response.ok) {
          app.transcriptionURL = transcriptionURL;
          console.log(`Transcricao encontrada na tentativa ${attempt}.`);
          console.log(`URL da transcricao: ${app.transcriptionURL}`);
          ui.setStatus('Transcricao pronta. Analisando momento viral com IA...', 'info');
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
    ui.setStatus('A transcricao ainda nao ficou pronta. Tente novamente em alguns minutos.', 'warning');
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

    if (!response.ok) {
      throw new Error(`Gemini respondeu com erro ${response.status}.`);
    }

    const data = await response.json();

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Gemini nao retornou um intervalo valido.');
    }
    
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

    if (error) {
      ui.setStatus('Falha ao abrir ou processar upload no Cloudinary.', 'error');
      ui.setButtonState(false, 'Enviar video para processamento');
      return;
    }

    if (result && result.event === 'close') {
      ui.setButtonState(false, 'Enviar video para processamento');
      ui.setStatus('Upload cancelado. Quando quiser, envie novamente.', 'warning');
      return;
    }

    if (!error && result && result.event === "success") { 
      console.log('Done! Here is the image info: ', result.info);
      app.public_id = result.info.public_id;
      ui.setStatus('Upload concluido. Preparando transcricao...', 'info');
      
      try{
        const isReady = await app.waitForTranscription();
        
        if(!isReady) {
          throw new Error('Erro ao buscar a transcrição.');
        }

        const viralMoment = await app.getViralMomentTime();
        const viralMomentURL = `https://res.cloudinary.com/${config.cloudName}/video/upload/${viralMoment}/${app.public_id}.mp4`;
        app.viralMomentURL = viralMomentURL;
        el.video.setAttribute('src', viralMomentURL);
        ui.setDownloadButtonState(true);
        ui.setStatus('Recorte gerado com sucesso. Dê o play e revise o resultado.', 'success');
      } catch(error){
        console.log({error});
        ui.setStatus('Nao foi possivel gerar o recorte agora. Verifique a API key e tente novamente.', 'error');
      } finally {
        ui.setButtonState(false, 'Enviar video para processamento');
      }
    }
  }
)

el.button.addEventListener("click", () =>{
  if(!el.apiKey.value) {
    ui.setStatus('Insira sua chave da API Gemini antes de iniciar.', 'warning');
    el.apiKey.focus();
    return;
  }

  app.viralMomentURL = '';
  ui.setDownloadButtonState(false);
  ui.setButtonState(true, 'Abrindo uploader...');
  ui.setStatus('Conectando ao Cloudinary para iniciar o upload.', 'info');
  myWidget.open();
}, false);

el.downloadButton.addEventListener('click', () => {
  ui.downloadViralVideo();
});

ui.setDownloadButtonState(false);

if (window.lucide) {
  lucide.createIcons();
}

if (window.gsap) {
  gsap.set('.reveal-up', { opacity: 0, y: 26 });
  gsap.to('.reveal-up', {
    opacity: 1,
    y: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.1,
  });
}