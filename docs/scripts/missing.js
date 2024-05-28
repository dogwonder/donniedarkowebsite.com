var missingScripts = {

  animateText: function(element, audioFile) {
      const text = document.getElementById(element);
      // If no text is found bail
      if (!text) return;
  
      const words = text.innerHTML.split(' ');
      text.innerHTML = '';
  
      let audio = this.createAudio(audioFile);
  
      let wordPromises = words.map((word, i) => this.animateWord(word, i, text));
  
      Promise.all(wordPromises).then(() => {
          this.finishAnimation(audio);
      });
  },
  
  createAudio: function(audioFile) {
      let audio;
      if (audioFile) {
          audio = new Audio(audioFile);
          audio.play();
      }
      return audio;
  },
  
  animateWord: function(word, i, text) {
      return new Promise((resolve) => {
          setTimeout(() => {
              text.innerHTML += word + ' ';
              resolve();
          }, i * 10);
      });
  },
  
  finishAnimation: function(audio) {
      if (audio) {
          audio.pause();
      }
      const event = new CustomEvent('wordsFinished');
      document.dispatchEvent(event);
      console.log('wordsFinished');
  }

}