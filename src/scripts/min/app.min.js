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

  setGradientHeight: function(element, amount) {
    
    // Get the canvas element
    const obj = document.getElementById(element);
  
    // If no obj bail
    if (!obj) return;
  
    // Get the width and height of the canvas
    let width = obj.clientWidth;
    let height = obj.clientHeight;
  
    // Get the distance from the top of the page to the canvas
    let objectHeightMin = height * amount;
    let objectHeightMax = height;
  
    console.log(`Height Min: ${objectHeightMin}`);
    console.log(`Height Max: ${objectHeightMax}`);
    
    // Change the CSS var --gradient to match the height of the canvas
    document.documentElement.style.setProperty('--gradient-height-min', `${objectHeightMin}px`);
    document.documentElement.style.setProperty('--gradient-height-max', `${objectHeightMax}px`);
  }

}

document.addEventListener("DOMContentLoaded", function() {

  ddScripts.ruffleEmbeds();
  ddScripts.setGradientHeight();

}); 