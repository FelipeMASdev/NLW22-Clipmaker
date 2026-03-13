const config = {
  cloudName: 'difsq0sla',
  uploadPreset: 'nlw_clipmaker'
}

const myWidget = cloudinary.createUploadWidget(
  config,
  (error, result) => { 
    if (!error && result && result.event === "success") { 
      console.log('Done! Here is the image info: ', result.info);
    }
  }
)

document.getElementById("upload_widget").addEventListener("click", () =>{
  myWidget.open();
}, false);