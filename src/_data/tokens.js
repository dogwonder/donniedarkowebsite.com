const slugify = require("slugify");

//Get the clamp generator
const clampGenerator = require('../generators/utils/clamp-generator.js');

//Get tokens
const colorTokens = require('../generators/tokens/colors.json');
const spacingTokens = require('../generators/tokens/spacing.json');
const fontTokens = require('../generators/tokens/fontsizes.json');

module.exports = {

    //Loop through the colors and create a color palette
    colorMap: colorTokens.items.map(({name, color}) => {
        return {
            //Lowercase the name 
            name: slugify(name, {
                lower: true,
                strict: true,
            }),
            color
        };
    }), 

    //Get spacing tockens and pass them to the clamp generator

    //Generate an object of spacingTokens.items
    //Get the spacingTokens and pass the items to the clamp generator
    spacing: clampGenerator(spacingTokens.items),


    //Generate an object of spacingTokens.items
    //Get the spacingTokens and pass the items to the clamp generator
    fontsizes: clampGenerator(fontTokens.items)
}