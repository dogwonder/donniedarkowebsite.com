var ddScripts = {

    // 'use strict';

    ruffleEmbeds: function() {

        const ruffleSources = ['object.aspect-ratio ruffle-embed', 'object.aspect-ratio ruffle-player', '.ruffle-container'];

        //If no ruffle embeds are found bail
        if (!ruffleSources) return;

        document.querySelectorAll(ruffleSources.join(",")).forEach((object) => {
          object.style.maxWidth = "100%";
          object.style.height = "auto";
          object.style.aspectRatio = `${object.getAttribute(
            "width"
          )} / ${object.getAttribute("height")}`;
        });

    },

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

document.addEventListener("DOMContentLoaded", function() {

  ddScripts.ruffleEmbeds();

}); 