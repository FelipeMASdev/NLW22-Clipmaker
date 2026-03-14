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
    const transcription = await app.getTranscription()
  },
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
      
      const isReady = app.waitForTranscription();
    }
  }
)

document.getElementById("upload_widget").addEventListener("click", () =>{
  myWidget.open();
}, false);