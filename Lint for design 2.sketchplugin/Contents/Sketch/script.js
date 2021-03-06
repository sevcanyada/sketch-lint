
const sketch = require('sketch/dom');
var appName = 'Text Validator', suffix = 'pt';


const IDENTIFIER = "com.policeplugin.sketchlint";

const DEFINITION_URLS = {
  unit: 'https://api.myjson.com/bins/obu1g'
};

const DEFAULT_DEFINITIONS = {
  color: {},
  font: {},
  unit: {}
};

function getPreferences(key) {
    var userDefaults = NSUserDefaults.standardUserDefaults();
    if (!userDefaults.dictionaryForKey(IDENTIFIER)) {
        var defaultPreferences = NSMutableDictionary.alloc().init();
        defaultPreferences.setObject_forKey(JSON.stringify(DEFAULT_DEFINITIONS.color), "color");
        defaultPreferences.setObject_forKey(JSON.stringify(DEFAULT_DEFINITIONS.font), "font");
        defaultPreferences.setObject_forKey(JSON.stringify(DEFAULT_DEFINITIONS.unit), "unit");

        userDefaults.setObject_forKey(defaultPreferences, IDENTIFIER);
        userDefaults.synchronize();
    }

    return JSON.parse(userDefaults.dictionaryForKey(IDENTIFIER).objectForKey(key));
}

function setPreferences(key, value) {
    var userDefaults = NSUserDefaults.standardUserDefaults();
    if (!userDefaults.dictionaryForKey(IDENTIFIER)) {
        var preferences = NSMutableDictionary.alloc().init();
    } else {
        var preferences = NSMutableDictionary.dictionaryWithDictionary(userDefaults.dictionaryForKey(IDENTIFIER));
    }
    preferences.setObject_forKey(JSON.stringify(value), key);
    userDefaults.setObject_forKey(preferences, IDENTIFIER);
    userDefaults.synchronize();
}


// MAIN FUNCTIONS

// to check for text color for selected artboard
function checkTextColor(context, colorRules) {
  var contextnew = context.selection.objectAtIndex(0);
  var artboardType = checkArtboard(context);  
  textColor(context, contextnew, colorRules);
};

// to check the layer colors
function checkColor(context) {
  var colorRules =  getPreferences('color');  
  if(Object.keys(colorRules).length == 0){
    updateDefinitions();
    var colorRules =  getPreferences('color'); 
    // log("here 32"); 
  }
  var contextnew = context.selection.objectAtIndex(0);
  var artboardType = checkArtboard(context);
  // log("here");
  color(context, contextnew, colorRules);
  // checkTextColor(context, colorRules);
};

// to check for spelling
// function checkSpelling(context){
//   var contextnew = context.selection.objectAtIndex(0);
//   log("here");
//   log(contextnew);
//   spellingAllPage(context);
// };

// to check text contrast
function checkContrast (context){
  var doc = context.document;
  var selection = context.selection; 
  var page = doc.currentPage();
  var app = NSApplication.sharedApplication();

  if (selection.count() == 0){
    doc.showMessage("Please select one or two layers to test the contrast.");
  }

  if (selection.count() == 1){
    var layer1 = selection[0];
    var color1 = getColorOfLayer(layer1);

    if(color1[0]){
      var textLayer = color1[1];
    }

    if (page.currentArtboard() != null) {
      // get the color of the artboard
      color2 = page.currentArtboard().backgroundColor();
      var result = contrast(color1[2], color2);
      displayConstrast(doc, textLayer, result);
    }
  }

  if(selection.count() == 2){
    var layer1 = selection[0];
    var layer2 = selection[1];

    var color1 = getColorOfLayer(layer1);
    var color2 = getColorOfLayer(layer2);
    if(color1[0]){
      var textLayer = color1[1];
    }
    if(color2[0]){
      var textLayer = color2[1];
    }

    var result = contrast(color1[2], color2[2]);
    displayConstrast(doc, textLayer, result);
  }
};

function loadJSON(){
  var openPanel = NSOpenPanel.openPanel();
    openPanel.setTitle( "Select a JSON file for the text styles" ); 
    openPanel.setCanCreateDirectories = false; 
    openPanel.setCanChooseFiles = true; 

  var fileTypes = ['json']; 
  var openPanelButtonPressed = openPanel.runModalForDirectory_file_types_( nil, nil, fileTypes );

  if ( openPanelButtonPressed == NSFileHandlingPanelOKButton ) {
    var filePath = openPanel.URL().path();
    var selectedJson = JSON.parse( NSString.stringWithContentsOfFile( filePath ) );
    setPreferences("font", selectedJson);
  } else {
    return false;
  }
}


function loadColorJSON(){
  var openPanel = NSOpenPanel.openPanel();
    openPanel.setTitle( "Select a JSON file for the text styles" ); 
    openPanel.setCanCreateDirectories = false; 
    openPanel.setCanChooseFiles = true; 

  var fileTypes = ['json']; 
  var openPanelButtonPressed = openPanel.runModalForDirectory_file_types_( nil, nil, fileTypes );

  if ( openPanelButtonPressed == NSFileHandlingPanelOKButton ) {
    var filePath = openPanel.URL().path();
    var selectedJson = JSON.parse( NSString.stringWithContentsOfFile( filePath ) );
    setPreferences("color", selectedJson);
  } else {
    return false;
  }
}


function checkFont(context){
  updateDefinitions();

  var contextnew = context.selection.objectAtIndex(0);
  var artboardType = checkArtboard(context);
  // check fontsize + line height + weight
  typography(context, contextnew, artboardType);
}

function displayPaddingErrors (artboard, errors) {
  const container = new sketch.Group({
    parent: artboard,
    name: 'Padding errors'
  });

  errors.forEach(error => {
    new sketch.Shape({
      parent: container,
      frame: new sketch.Rectangle(error.x, error.y, 2, error.height),
      style: {
        fills: ['#FF0202'],
        borders: [],
      }
    });
    new sketch.Text({
      text: `${error.height.toFixed()}pt`,
      parent: container,
      frame: new sketch.Rectangle(error.x + 4, error.y),
      style: {
        fills: ['#FF0202'],
        borders: [],
      }
    });
  });
}

function updateDefinitions () {
  Object.keys(DEFINITION_URLS).forEach(key => {
    var request = NSMutableURLRequest.alloc().init();
    request.setHTTPMethod_("GET");
    request.setURL_(NSURL.URLWithString_(DEFINITION_URLS[key]));
    const responseData = NSURLConnection.sendSynchronousRequest_returningResponse_error_(request,nil,nil);
    setPreferences(key, JSON.parse(NSString.alloc().initWithData_encoding_(responseData,NSUTF8StringEncoding)));
  });
}

function getLayerList(
  items,
  matchRule = () => true,
  skipRule = () => false,
  offset = { x: 0, y: 0 }
) {
  // log("item:" + items);

  items = Array.isArray(items) ? items : items.layers || [];

  

  return items.reduce((acc, next) => {
    if (skipRule(next)) {
      return acc;
    }
    const computedOffset = {
      x: next.frame ? next.frame.x + offset.x : offset.x,
      y: next.frame ? next.frame.y + offset.y : offset.y
    };
    let layers = [];
    if (next.layers && next.layers.length) {
      layers = getLayerList(next.layers, matchRule, skipRule, computedOffset);
    }
    if (matchRule(next)) {
      next.position = computedOffset;
      layers.unshift(next);
    }
    return acc.concat(layers);
  }, []);
}

// SUPPORTING FUNCTIONS

function validateDistance (num) {
  const DISTANCES = Object.values(getPreferences('unit'));
  if (num > 0 && num < DISTANCES[0]) {
    // log("this is after" + num);
    return DISTANCES.includes(num);
  }
  return true;
}

function checkPadding (context) {
  updateDefinitions();
  var doc = context.document;
  const document = sketch.getSelectedDocument();

  var artboard = sketch.fromNative(context.selection.objectAtIndex(0));

      const errors = [];
      const layers = getLayerList(
        artboard,
        item => !['Page', 'Artboard', 'Group'].includes(item.type),
        item => item.hidden
      ).filter(layer => layer.type).sort((a, b) => a.position.y - b.position.y);

      if (!layers.length) return;

      // Check first layer distance from the top
      if (!validateDistance(layers[0].position.y)) {
        errors.push({
          x: layers[0].position.x + layers[0].frame.width / 2,
          y: 0,
          height: layers[0].position.y
        });
      }
      
      layers.forEach(layer => {
        // Find the top/bottom distances inside containes such as background images
        if (['Image', 'Rectangle', 'Gradient'].includes(layer.type)) {

          const containedLayers = layers.filter(itemToCheck => (
            itemToCheck.id !== layer.id &&
            itemToCheck.position.y >= layer.position.y &&
            itemToCheck.position.y + itemToCheck.frame.height <= layer.position.y + layer.frame.height &&
            itemToCheck.position.x >= layer.position.x &&
            itemToCheck.position.x + itemToCheck.frame.width <= layer.position.x + layer.frame.width
          ));
          if (containedLayers.length) {
            const containedLayersByStart = [].concat(containedLayers).sort((a, b) => a.position.y - b.position.y);
            const containedLayersByEnd = [].concat(containedLayers).sort((a, b) =>
              a.position.y + a.frame.height - (b.position.y + b.frame.height));
            const firstContainedElement = containedLayersByStart[0];
            const lastContainedElement = containedLayersByEnd[containedLayersByEnd.length - 1];

            // Check the first contained layer against the top of the container
            if (!validateDistance(firstContainedElement.position.y - layer.position.y)) {
              errors.push({
                x: firstContainedElement.position.x + firstContainedElement.frame.width / 2,
                y: layer.position.y,
                height: firstContainedElement.position.y - layer.position.y
              });
            }

            // Check the last contained layer against the bottom of the container
            if (!validateDistance(
              layer.position.y + layer.frame.height - (lastContainedElement.position.y + lastContainedElement.frame.height)
            )) {
              errors.push({
                x: lastContainedElement.position.x + lastContainedElement.frame.width / 2,
                y: lastContainedElement.position.y + lastContainedElement.frame.height,
                height: layer.position.y + layer.frame.height - (lastContainedElement.position.y + lastContainedElement.frame.height)
              });
            }
          }
        }

        const layerEnd = layer.position.y + layer.frame.height;
        const nextItem = layers.find(itemToCompare => layerEnd < itemToCompare.position.y);

        if (nextItem) {
          // Check the distance between two items
          if (!validateDistance(nextItem.position.y - layerEnd)) {
            errors.push({
              x: (Math.max(layer.position.x, nextItem.position.x) + Math.min(layer.position.x + layer.frame.width, nextItem.position.x + nextItem.frame.width)) / 2,
              y: layerEnd,
              height: nextItem.position.y - layerEnd
            });
          }
          
        } else {
          // Check the distance between item end and page end
          if (!validateDistance(artboard.frame.height - layerEnd)) {
            errors.push({
              x: (layer.position.x + layer.frame.width) / 2,
              y: layerEnd,
              height: artboard.frame.height - layerEnd
            });
          }
        }
      });

      if (errors.length) {
        doc.showMessage("The marked areas have padding issues. Happy fixing 😊");
        displayPaddingErrors(artboard, errors);
      }
      else {
        doc.showMessage("Well done 🙌 No issues found.");
      }
}

function calculateMatchScore(fontSize, fontFamily, lineHeight, fontWeight, textColor, ruleItem, maxFontSize, maxLineHeight, maxFontWeight){

  // score for font name matching -> lower the better
  var fontnameMatchScore = 1-similarity(fontFamily, ruleItem.font);

  // test for fuzzy logic
  // var ruleItemFont = ruleItem.font;
  // var ruleItemFontObj = ruleItemFont.toString();
  // var fontFamilyObj = fontFamily.toString();

  // var result = ruleItemFontObj.fontNameScore(fontFamilyObj, 0.5);
  // var fontnameMatchScore = 1- fontFamily.fontNameScore(ruleItem.font, 0.5);


  // score for fontWeight -> lower the better
  var fontweightMatchScore = Math.abs((fontWeight - ruleItem.fontweight)/maxFontWeight);

  // score for lineHeight -> lower the better
  var lineheightMatchScore = Math.abs((lineHeight - ruleItem.lineHeight)/maxLineHeight);

  // score for fontsize -> lower the better
  var thsiis = (fontSize - ruleItem.size)/maxFontSize;
  // log("fontsizeMatchScore:" + thsiis);

  var fontsizeMatchScore = Math.abs((fontSize - ruleItem.size)/maxFontSize);
  
  // score for textcolor -> lower the better
  var myRegexp = /\(r:(.*) g:(.*) b:(.*) a:(.*)\)/g;
  var colorValues = myRegexp.exec(textColor);

  var redColorValue = (Math.round(colorValues[1] * 100) / 100)*255;
  var greenColorValue = (Math.round(colorValues[2] * 100) / 100)*255;
  var blueColorValue = (Math.round(colorValues[3] * 100) / 100)*255;

  var redRule = (Math.round(ruleItem.color.red * 100) / 100)*255;
  var greenRule = (Math.round(ruleItem.color.green * 100) / 100)*255;
  var blueRule = (Math.round(ruleItem.color.blue * 100) / 100)*255;

  var colorMatchScore = deltaE([redColorValue, greenColorValue, blueColorValue], [redRule, greenRule, blueRule])/100;

  var matchScore = {fontnameMatchScore: fontnameMatchScore,fontweightMatchScore: fontweightMatchScore, lineheightMatchScore:lineheightMatchScore, fontsizeMatchScore:fontsizeMatchScore, colorMatchScore:colorMatchScore}
  return matchScore;
}

function similarity(s1, s2) {
  if(s1.length > s2.length){
    var longer = s1;
    var shorter = s2;
  }else{
    var longer = s2;
    var shorter = s1;
  }
 
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0)
        costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function deltaE(rgbA, rgbB) {
  let labA = rgb2lab(rgbA);
  let labB = rgb2lab(rgbB);
  let deltaL = labA[0] - labB[0];
  let deltaA = labA[1] - labB[1];
  let deltaB = labA[2] - labB[2];
  let c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
  let c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
  let deltaC = c1 - c2;
  let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
  let sc = 1.0 + 0.045 * c1;
  let sh = 1.0 + 0.015 * c1;
  let deltaLKlsl = deltaL / (1.0);
  let deltaCkcsc = deltaC / (sc);
  let deltaHkhsh = deltaH / (sh);
  let i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}

function rgb2lab(rgb){
  let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}

// find the max number for each category. Divide 1 by that number. Multiply every item with this. 
function normalize(totalScoreArray){
  var totalScoreArrayNew = [];
  for ( var i = 0; i < totalScoreArray.length; i++ ) {
    totalScoreArrayNew [i] = new Array(5);
  }

  for(j=0;j<5; j++){
    var maxScore = 0;

    for(i=0; i<totalScoreArray.length; i++){
      if(totalScoreArray[i][j]> maxScore){
        maxScore = totalScoreArray[i][j];
        var item = i;
      }
    }
    // log("start");

    // log("maxScore for " + j + ": " + maxScore + "for item : " + item);

    var normalizeFactor = 1/maxScore;
    // log("normalizeFactor" + normalizeFactor);

    // log("this is it");
    for(i=0; i<totalScoreArray.length; i++){
      // log ("this");
      // log(totalScoreArray[i][j]);
      totalScoreArrayNew[i][j] =  totalScoreArray[i][j] * normalizeFactor;
      // log(totalScoreArray[i][j]);
    }

    for(i=0; i<totalScoreArray.length; i++){
      if(totalScoreArray[i][j]> maxScore){
        maxScore = totalScoreArray[i][j];
        var item = i;
      }
    }
    // log("maxScore for " + j + ": " + maxScore + "for item : " + item);
    // log("end");

  }
  return totalScoreArrayNew;
}

String.prototype.fontNameScore = function (word, fuzziness) {
  'use strict';

  // If the string is equal to the word, perfect match.
  if (this === word) { return 1; }

  //if it's not a perfect match and is empty return 0
  if (word === "") { return 0; }

  var runningScore = 0,
      charScore,
      finalScore,
      string = this,
      lString = string.toLowerCase(),
      strLength = string.length,
      lWord = word.toLowerCase(),
      wordLength = word.length,
      idxOf,
      startAt = 0,
      fuzzies = 1,
      fuzzyFactor,
      i;

  // Cache fuzzyFactor for speed increase
  if (fuzziness) { fuzzyFactor = 1 - fuzziness; }

  // Walk through word and add up scores.
  // Code duplication occurs to prevent checking fuzziness inside for loop
  if (fuzziness) {
    for (i = 0; i < wordLength; i+=1) {

      // Find next first case-insensitive match of a character.
      idxOf = lString.indexOf(lWord[i], startAt);

      if (idxOf === -1) {
        fuzzies += fuzzyFactor;
      } else {
        if (startAt === idxOf) {
          // Consecutive letter & start-of-string Bonus
          charScore = 0.7;
        } else {
          charScore = 0.1;

          // Acronym Bonus
          // Weighing Logic: Typing the first character of an acronym is as if you
          // preceded it with two perfect character matches.
          if (string[idxOf - 1] === ' ') { charScore += 0.8; }
        }

        // Same case bonus.
        if (string[idxOf] === word[i]) { charScore += 0.1; }

        // Update scores and startAt position for next round of indexOf
        runningScore += charScore;
        startAt = idxOf + 1;
      }
    }
  } else {
    for (i = 0; i < wordLength; i+=1) {
      idxOf = lString.indexOf(lWord[i], startAt);
      if (-1 === idxOf) { return 0; }

      if (startAt === idxOf) {
        charScore = 0.7;
      } else {
        charScore = 0.1;
        if (string[idxOf - 1] === ' ') { charScore += 0.8; }
      }
      if (string[idxOf] === word[i]) { charScore += 0.1; }
      runningScore += charScore;
      startAt = idxOf + 1;
    }
  }

  // Reduce penalty for longer strings.
  finalScore = 0.5 * (runningScore / strLength    + runningScore / wordLength) / fuzzies;

  if ((lWord[0] === lString[0]) && (finalScore < 0.85)) {
    finalScore += 0.15;
  }

  return finalScore;
};

function typography(context, artboard, artboardType){
  var fontrules =  getPreferences('font');
  var UI = require('sketch/ui');
  // var fontrulesjson = getFontRules(fontrules);

  var doc = context.document;
  var text = '',
      app = NSApplication.sharedApplication();

  var validArtboard = true;
  var layers = artboard.children();

  var newGroup = MSLayerGroup.new(); 
  newGroup.name = "Font errors";

  // var fixGroup = MSLayerGroup.new(); 
  // fixGroup.name = "Fix";

  context.document.currentPage().currentArtboard().addLayers([newGroup]);

  for (var k = 0; k < layers.count(); k++) {
    
    var layer = layers.objectAtIndex(k);

    // hide the layers in groups which are hidden
    if(layer.class() == "MSLayerGroup" && (layer.isVisible()==0)){
      var hiddenLayers = layer.children();
      for(var g = 0; g < hiddenLayers.count(); g++){
        hiddenLayers.objectAtIndex(g).setIsVisible(false);
      }
    }


    if ((layer.class() == "MSTextLayer") && (layer.isVisible()!=0)) {
      var validFont = false;

      var keys = Object.keys(fontrules.styles);
      var fontSize = layer.fontSize();
      var fontFamily = layer.font().fontName();
      var lineHeight = layer.lineHeight();
      var fontWeight = NSFontManager.sharedFontManager().weightOfFont_(layer.font());
      var textColor = layer.textColor();

      var myRegexp = /\(r:(.*) g:(.*) b:(.*) a:(.*)\)/g;
      var colorValues = myRegexp.exec(textColor);

      var redColorValue = Math.round(colorValues[1] * 100) / 100;
      var greenColorValue = Math.round(colorValues[2] * 100) / 100;
      var blueColorValue = Math.round(colorValues[3] * 100) / 100;

      var maxFontSize = 0; var maxLineHeight = 0; var maxFontWeight = 0; 
      // var firstItem = fontrules.styles[0];
      // var fontNameArray = [firstItem.font];

      // find the maximum values of each metric and fontnames
      for( var l = 0; l< keys.length; l++){
        var ruleItem = fontrules.styles[l];
        if(maxFontSize < ruleItem.size){
          maxFontSize = ruleItem.size;
        }
        if(maxLineHeight < ruleItem.lineHeight){
          maxLineHeight = ruleItem.lineHeight;
        }
        if(maxFontWeight < ruleItem.fontweight){
          maxFontWeight = ruleItem.fontweight;
        }
      }

      var totalScoreArray = [];
      // log("totalScoreArray");

      // check if the rules are followed
      for( var l = 0; l< keys.length; l++){
        var ruleItem = fontrules.styles[l];
        var redRule = Math.round(ruleItem.color.red * 100) / 100;
        var greenRule = Math.round(ruleItem.color.green * 100) / 100;
        var blueRule = Math.round(ruleItem.color.blue * 100) / 100;

        if( (fontSize == ruleItem.size) && (lineHeight == ruleItem.lineHeight) && (fontFamily == ruleItem.font) && (fontWeight == ruleItem.fontweight) && (redColorValue == redRule)  && (greenColorValue == greenRule)  && (blueColorValue == blueRule)  ){
           validFont = true;
           break;
        }
        else{

          var matchScore = calculateMatchScore(fontSize, fontFamily, lineHeight, fontWeight, textColor, ruleItem, maxFontSize, maxLineHeight, maxFontWeight);
          matchScore.ruleNumber = l;
          var fontnameMatchScore = {ruleNumber : l, totalscore: (matchScore.colorMatchScore + matchScore.fontnameMatchScore + matchScore.fontsizeMatchScore + matchScore.fontweightMatchScore + matchScore.lineheightMatchScore)}; 
          matchScore.totalscore = (matchScore.colorMatchScore*2 + matchScore.fontnameMatchScore*4 + matchScore.fontsizeMatchScore*5 + matchScore.fontweightMatchScore*3 + matchScore.lineheightMatchScore*1)/15;
          
          // log("matchScore");
          // log(matchScore);
          var allMatchScore = {}
          totalScoreArray [l] = new Array(5);
          totalScoreArray[l][0] =  matchScore.colorMatchScore;
          totalScoreArray[l][1] =  matchScore.fontnameMatchScore;
          totalScoreArray[l][2] =  matchScore.fontsizeMatchScore;
          totalScoreArray[l][3] =  matchScore.fontweightMatchScore;
          totalScoreArray[l][4] =  matchScore.lineheightMatchScore;

          // log("rules for" + l + ":");
          // log (totalScoreArray[l]);
        }
      }


      // end here
      var normalizedMatchScore = normalize (totalScoreArray);

      for(i=0;i<normalizedMatchScore.length;i++){
        // log("rules for" + i + ":");
        // log (totalScoreArray[i][2]);

        log("normalized rules for" + i + ":");
        log (normalizedMatchScore[i][2]);

      }


      var threeMatchSet = threeMatch(normalizedMatchScore);

      var maxPoints = threeMatchSet[0];
      var maxIndex = threeMatchSet[1];

      log("maxPoints");
      log(maxPoints);
      log("maxIndex");
      log(maxIndex);

      // var newGroup = MSLayerGroup.new(); 
      // newGroup.name = "Font fixes for ----";

      var textContent = layer.stringValue();
      for (i=0;i<3;i++){

        var index = maxIndex[i];
        var correctRule = fontrules.styles[index];

        var correctFont = correctRule.font;
        var correctFontSize = correctRule.size;
        var correctLineHeight = correctRule.lineHeight;
        var correctFontWeight = correctRule.fontweight;
        var correctColor = correctRule.color;
        
        var correctColorHex = rgbToHex(correctColor.red, correctColor.green, correctColor.blue);
        var replaceColor = MSImmutableColor.colorWithSVGString(correctColorHex).newMutableCounterpart();

        // create layer over
        var duplicatedLayer = layer.duplicate();
        // duplicatedLayer.stringValue = "this is shit";
        duplicatedLayer.name = "variation :" +(i+1) + " | fixed text style";
        duplicatedLayer.setFontPostscriptName(correctFont);
        duplicatedLayer.fontSize = correctFontSize;
        duplicatedLayer.lineHeight = correctLineHeight;
        duplicatedLayer.setTextColor(replaceColor);
      }

      if(!validFont){
        var layerName = "Text rule error";

        // display the error
        var layerNew = layer;
        var positionX = layerNew.frame().x(); 
        var positionY = layerNew.frame().y();

        while (layerNew.parentGroup().class() == "MSLayerGroup"){
          positionX += layerNew.parentGroup().frame().x() ;
          positionY += layerNew.parentGroup().frame().y() ;
          layerNew = layerNew.parentGroup();
        }

        var x = positionX + (layer.frame().width()/2);
        var y = positionY + (layer.frame().height()/2);

        var shapeGroup = MSShapeGroup.shapeWithRect(NSMakeRect(x-5,y-5,10,10));

        shapeGroup.name = layerName;
        var fill = shapeGroup.style().addStylePartOfType(0);
        fill.color = MSColor.colorWithRGBADictionary({r: 0.8, g: 0.1, b: 0.1, a: 1});

        newGroup.addLayers([shapeGroup]);
      }
      else {
        layerName = ''
      }

    }
  }

  if (layerName == '') {
    doc.showMessage("Well done 🙌 No issues found.");
  } else {
    doc.showMessage("The text layers marked in red have font issues. Happy fixing 😊");
  }
};

function threeMatch(totalScoreArray){
  var maxIndex = new Array();
  var maxPoints = new Array();
  for (var i = 0; i < totalScoreArray.length; i ++) {
    if (i === 0) {
      maxPoints.push(totalScoreArray[i]);
      maxIndex.push(i);
    } else if (i === 1) {
      if (totalScoreArray[i] < maxPoints[0]) {
        maxPoints.push(maxPoints[0]);       
        maxPoints[0] = totalScoreArray[i];
        maxIndex.push(maxIndex[0]);
        maxIndex[0] = i;
      } else {
        maxPoints.push(totalScoreArray[i]);
        maxIndex.push(i);
      }
    } else if (i === 2) {
      if (totalScoreArray[i] < maxPoints[0]) {
        maxPoints.push(maxPoints[0]);
        maxPoints[1] = maxPoints[0];
        maxPoints[0] = totalScoreArray[i];
        maxIndex.push(maxIndex[0]);
        maxIndex[1] = maxIndex[0];
        maxIndex[0] = i;
        
      } else {
        if (totalScoreArray[i] < maxPoints[1]) {
          maxPoints.push(maxPoints[1]);
          maxPoints[1] = totalScoreArray[i];
          maxIndex.push(maxIndex[1]);
          maxIndex[1] = i;
        } else {
          maxPoints.push(totalScoreArray[i]);
          maxIndex.push(i);
        }
      }
    } else {
      if (totalScoreArray[i] < maxPoints[0]) {
        maxPoints[2] = maxPoints[1];
        maxPoints[1] = maxPoints[0];
        maxPoints[0] = totalScoreArray[i];
        maxIndex[2] = maxIndex[1];
        maxIndex[1] = maxIndex[0];
        maxIndex[0] = i;
      } else {
        if (totalScoreArray[i] < maxPoints[1]) {
          maxPoints[2] = maxPoints[1];
          maxPoints[1] = totalScoreArray[i];
          maxIndex[2] = maxIndex[1];
          maxIndex[1] = i;
        } else if(totalScoreArray[i] < maxPoints[2]) {
          maxPoints[2] = totalScoreArray[i];
          maxIndex[2] = i;
        }
      }
    }
  }
  return [maxPoints, maxIndex];
}

function checkArtboard (context){
  var doc = context.document;
  var selection = context.selection; 
  var page = doc.currentPage();
  var app = NSApplication.sharedApplication();
  var artboardType = "web";

  var artboardWidth = page.currentArtboard().frame().width();

  if(artboardWidth == 320){
    artboardType = "mweb";
  }
  if(artboardWidth == 375){
    artboardType = "ios";
  }
  if(artboardWidth == 360){
    artboardType = "android";
  }
  return (artboardType);
};

// convert rgb value to Hex
function rgbToHex(r, g, b) {

  if (Math.round(r*255).toString(16) == "0"){
    var red = "00";
  }else{
    var red = Math.round(r*255).toString(16);
    if(red.length == 1){
      red = "0" + red;
    }
  }

  if (Math.round(g*255).toString(16) == "0"){
    var green = "00";
  }else{
    var green = Math.round(g*255).toString(16);
    if(green.length == 1){
      green = "0" + green;
    }
  }

  if (Math.round(b*255).toString(16) == "0"){
    var blue = "00";
  }else{
    var blue = Math.round(b*255).toString(16);
    if(blue.length == 1){
      blue = "0" + blue;
    }
  }

  return ("#" + red.toUpperCase() + green.toUpperCase() + blue.toUpperCase());
};

var hexToRGB = function(hex, alpha) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex),
        red = parseInt(result[1], 16),
        green = parseInt(result[2], 16) ,
        blue = parseInt(result[3], 16),
        alpha = (typeof alpha !== 'undefined') ? alpha : 1;
    // return NSColor.colorWithCalibratedRed_green_blue_alpha(red, green, blue, alpha)
    return [Math.round(red ), Math.round(green), Math.round(blue)];
};

function hslToRgb(h, s, l){

  var r, g, b;

  if(s == 0){
      r = g = b = l; // achromatic
  }else{
      var hue2rgb = function hue2rgb(p, q, t){
          if(t < 0) t += 1;
          if(t > 1) t -= 1;
          if(t < 1/6) return p + (q - p) * 6 * t;
          if(t < 1/2) return q;
          if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
      }

      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function colorSetRGB(colorSetValue){

  var colorSetValueRgb = [];
  for(i =0; i<colorSetValue.length; i++){
    colorSetValueRgb[i]= hslToRgb(colorSetValue[i][0]/360, colorSetValue[i][1]/100, colorSetValue[i][2]/100);
    // var colorSetValueRgb = 
  }
  return(colorSetValueRgb);
}

function colorSetOld(colorRules, hsl, a) {

  var keys = Object.keys(colorRules);
  for(var i =0; i<keys.length; i++){
    key = keys[i];

    if(key == "hsl"){
      var hslLength = hsl.length;
      hsl[hslLength] = colorRules[key];
    }

    if ( (Object.keys(colorRules[key])).length > 0){
      colorSet(colorRules[key], hsl, a);
    }
  }
  return(hsl);
}

function colorSet(colorRules){
  var keys = Object.keys(colorRules);
  var colorSetValueRgb = [];

  for(var i =0; i<keys.length; i++){
    key = keys[i];
    var colorSetValueHex = colorRules[i].value;
    var colorSetValueHex = colorSetValueHex.replace('#', '');
    colorSetValueRgb[i] = hexToRGB(colorSetValueHex);

  }
  return(colorSetValueRgb);
  // log(keys);
}

function color(context, artboard, colorRules){
  var doc = context.document;
  var text = '',
      app = NSApplication.sharedApplication();

  var validArtboard = true;
  var layers = artboard.children();
  var hsl = []; 

  // var colorSetValue = colorSet(colorRules, hsl, 0);

  // var colorSetValueRgb = colorSetRGB(colorSetValue);

  var colorSetValueRgb = colorSet(colorRules);

  for (var k = 0; k < layers.count(); k++) {

    

    if(layers.objectAtIndex(k).class() == "MSLayerGroup" && (layers.objectAtIndex(k).isVisible()==0)){
      var hiddenLayers = layers.objectAtIndex(k).children();
      for(var g = 0; g < hiddenLayers.count(); g++){
        hiddenLayers.objectAtIndex(g).setIsVisible(false);
      }
    }
    var layerObject = layers.objectAtIndex(k);
    if ( ((layerObject.class() == "MSShapeGroup") || (layerObject.class() == "MSRectangleShape") || (layerObject.class() == "MSOvalShape") || (layerObject.class() == "MSTriangleShape") || (layerObject.class() == "MSStarShape") || (layerObject.class() == "MSPolygonShape")) && (layerObject.isVisible)){
      
      // check if the layer is visually visible
      // https://github.com/nathco/Swap-Fill-Border/blob/master/Swap-Fill-Border.sketchplugin/Contents/Sketch/Swap-Fill-Border.js
      
      var fillCount = layerObject.style().fills().count();
      var bordersCount = layerObject.style().borders().count();
      var visibleFill = false;
      var visibleBorder = false;

      for ( var f = 0; f < fillCount; f++){
        if (layerObject.style().fills().objectAtIndex(f).isEnabled()){
          visibleFill = true;
        }
      }

      for ( var b = 0; b < bordersCount; b++){
        if (layerObject.style().borders().objectAtIndex(b).isEnabled()){
          visibleBorder = true;
        }
      }
    }

    if (((layerObject.class() == "MSShapeGroup") || (layerObject.class() == "MSRectangleShape") || (layerObject.class() == "MSOvalShape") || (layerObject.class() == "MSTriangleShape") || (layerObject.class() == "MSStarShape") || (layerObject.class() == "MSPolygonShape")) && (layerObject.isVisible()!=0) && (visibleFill > 0))  {
      var validColor = false;

      // all text properties are here : http://developer.sketchapp.com/reference/api/file/api/Text.js.html#lineNumber48
      var layerColor = layerObject.style().fills().objectAtIndex(0).color();
      var myRegexp = /\(r:(.*) g:(.*) b:(.*) a:(.*)\)/g;
      var colorValues = myRegexp.exec(layerColor);
      
      // log("here" +"1:" + Math.round(parseFloat(colorValues[1])*255) + "2:" + Math.round(parseFloat(colorValues[2])*255) + "3:" + Math.round(parseFloat(colorValues[3])*255) )

      for (var l = 0; l < colorSetValueRgb.length; l++) {
        if( Math.round(parseFloat(colorValues[1])*255) == colorSetValueRgb[l][0] && Math.round(parseFloat(colorValues[2])*255) == colorSetValueRgb[l][1] && Math.round(parseFloat(colorValues[3])*255) == colorSetValueRgb[l][2]) {
          validColor = true;
          break;
        }
      }

      if (!validColor) {
        var closestColorSimilarity = 100;
        var closestColorIndex;
        // fixing colors
        for(m=0; m<colorSetValueRgb.length; m++){
          var colorSimilarity = deltaE([Math.round(parseFloat(colorValues[1])*255), Math.round(parseFloat(colorValues[2])*255), Math.round(parseFloat(colorValues[3])*255)],[colorSetValueRgb[m][0], colorSetValueRgb[m][1],colorSetValueRgb[m][2]]);
          if (colorSimilarity < closestColorSimilarity){
            closestColorSimilarity = colorSimilarity;
            closestColorIndex = m;
          }
        }

        // var fillCount = layers.objectAtIndex(k).style().fills().count();        
        layers.objectAtIndex(k).style().fills().objectAtIndex(0).color().setRed(colorSetValueRgb[closestColorIndex][0]/255);
        layers.objectAtIndex(k).style().fills().objectAtIndex(0).color().setGreen(colorSetValueRgb[closestColorIndex][1]/255);
        layers.objectAtIndex(k).style().fills().objectAtIndex(0).color().setBlue(colorSetValueRgb[closestColorIndex][2]/255);      

        var borderCount = layers.objectAtIndex(k).style().borders().count();
        layers.objectAtIndex(k).style().addStylePartOfType(1);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).setThickness(4);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).color().setRed(1);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).color().setGreen(0.13);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).color().setBlue(0.40);
        text += " color:       " + '  \"' + layers.objectAtIndex(k).name() + '\"  ' + rgbColor + '\n';
      }
    }

    if (((layerObject.class() == "MSShapeGroup") || (layerObject.class() == "MSRectangleShape") || (layerObject.class() == "MSOvalShape") || (layerObject.class() == "MSTriangleShape") || (layerObject.class() == "MSStarShape") || (layerObject.class() == "MSPolygonShape")) && (layerObject.isVisible()!=0) && (visibleBorder > 0)){
      var borderColor = layerObject.style().borders().objectAtIndex(0).color();
      var validColor = false;
      var layerObject = layers.objectAtIndex(k);

      var myRegexp = /\(r:(.*) g:(.*) b:(.*) a:(.*)\)/g;
      var colorValues = myRegexp.exec(borderColor);

      var rgbColor = rgbToHex( parseFloat(colorValues[1]), parseFloat(colorValues[2]), parseFloat(colorValues[3]));

      // check color valid or not
      for (var l = 0; l < colorSetValueRgb.length; l++) {
        if( Math.round(parseFloat(colorValues[1])*255) == colorSetValueRgb[l][0] && Math.round(parseFloat(colorValues[2])*255) == colorSetValueRgb[l][1] && Math.round(parseFloat(colorValues[3])*255) == colorSetValueRgb[l][2]) {
          validColor = true;
          break;
        }
      }

      if (!validColor) {

        var closestColorSimilarity = 100;
        var closestColorIndex;
        // fixing colors
        for(m=0; m<colorSetValueRgb.length; m++){
          var colorSimilarity = deltaE([Math.round(parseFloat(colorValues[1])*255), Math.round(parseFloat(colorValues[2])*255), Math.round(parseFloat(colorValues[3])*255)],[colorSetValueRgb[m][0], colorSetValueRgb[m][1],colorSetValueRgb[m][2]]);
          if (colorSimilarity < closestColorSimilarity){
            closestColorSimilarity = colorSimilarity;
            closestColorIndex = m;
          }
        }

        layers.objectAtIndex(k).style().borders().objectAtIndex(0).color().setRed(colorSetValueRgb[closestColorIndex][0]/255);
        layers.objectAtIndex(k).style().borders().objectAtIndex(0).color().setGreen(colorSetValueRgb[closestColorIndex][1]/255);
        layers.objectAtIndex(k).style().borders().objectAtIndex(0).color().setBlue(colorSetValueRgb[closestColorIndex][2]/255); 

        var borderCount = layers.objectAtIndex(k).style().borders().count();
        layers.objectAtIndex(k).style().addStylePartOfType(1);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).setThickness(2);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).color().setRed(1);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).color().setGreen(0.78);
        layers.objectAtIndex(k).style().borders().objectAtIndex(borderCount).color().setBlue(0.30);
        text += " color: " + '  \"' + layers.objectAtIndex(k).name() + '\"  ' + rgbColor + '\n';
      }
    }
  }

  if (text == '') {
    doc.showMessage("Well done 😎, no issues found.");
  } else {
    // doc.showMessage("The marked areas have padding issues. Happy fixing 😊");
    doc.showMessage("The layers marked in red have wrong fill colors, in yellow have wrong border colors. They have been fixed for you 😊");
  }
};

function getColorOfLayer(layer) {
  var color = null;

  var isText = null,
      textLayer = null;

  if (layer.class() == MSTextLayer){
    color = layer.textColor();
    textLayer = layer;
    fontSize = textLayer.fontSize();
    isText = true;

    var fill = layer.style().fills().firstObject();
    if(fill != undefined && fill.isEnabled())
      color = fill.color();
  }
  else{
    var fill = layer.style().fills().firstObject();
    // log("fills :" + fill);

    color = fill.color();
  }
  return [isText, textLayer, color];
};

function contrast(color1, color2) {

  // Color 1

  L1R = color1.red();
  if (L1R <= 0.03928) {
    L1R = color1.red() / 12.92;
  } else {
    L1R = Math.pow(((L1R + 0.055)/1.055), 2.4)
  }

  L1G = color1.green();
  if (L1G <= 0.03928) {
    L1G = color1.green() / 12.92;
  } else {
    L1G = Math.pow(((L1G + 0.055)/1.055), 2.4)
  }

  L1B = color1.blue();
  if (L1B <= 0.03928) {
    L1B = color1.blue() / 12.92;
  } else {
    L1B = Math.pow(((L1B + 0.055)/1.055), 2.4)
  }

  // Color 2

  L2R = color2.red();
  if (L2R <= 0.03928) {
    L2R = color2.red() / 12.92;
  } else {
    L2R = Math.pow(((L2R + 0.055)/1.055), 2.4)
  }

  L2G = color2.green();
  if (L2G <= 0.03928) {
    L2G = color2.green() / 12.92;
  } else {
    L2G = Math.pow(((L2G + 0.055)/1.055), 2.4)
  }

  L2B = color2.blue();
  if (L2B <= 0.03928) {
    L2B = color2.blue() / 12.92;
  } else {
    L2B = Math.pow(((L2B + 0.055)/1.055), 2.4)
  }

  var L1 = 0.2126 * L1R + 0.7152 * L1G + 0.0722 * L1B;
  var L2 = 0.2126 * L2R + 0.7152 * L2G + 0.0722 * L2B;

  // Make sure L1 is the lighter color

  if (L1 <= L2) {
    var temp = L2;
    L2 = L1;
    L1 = temp;
  }

  // Calculate contrast

  cr = (L1 + 0.05) / (L2 + 0.05);

  return cr;
};

function displayConstrast (doc, textLayer, result) {
  // Check against AA / AAA
  var status = "Contrast: AA Failed 😢";
  var fontSize = 14;

  if (textLayer != null) {
    var fontSize = textLayer.fontSize();
    var isBold = false;

    if (textLayer.fontPostscriptName().indexOf("Bold") != -1) {
      var isBold = true;
    }
  }


  if ((fontSize >= 18 || (fontSize >= 14 && isBold)) && result >=3) {
    status = "Contrast: AA passed (large text) 😎";
  }

  if(result >= 4.5) {
    status = "Contrast: AA passed 😎";
  }

  if ((fontSize >= 18 || (fontSize >= 14 && isBold)) && result >=4.5) {
    status = "Contrast: AAA passed (large text) 😎";
  }

  if(result >= 7.0) {
    status = "Contrast: AAA passed 😎";
  }

  var floored = Math.round((result.toString()) * 100) / 100;
  doc.showMessage(status + " - " + floored + ":1");
};

function textColor(context, artboard, colorRules) {
  var doc = context.document;
  var text = '',
      app = NSApplication.sharedApplication();

  var validArtboard = true;
  var layers = artboard.children();
  var hsl = []; 
  var colorSetValue = colorSet(colorRules, hsl, 0);
  var colorSetValueRgb = colorSetRGB(colorSetValue);

  for (var k = 0; k < layers.count(); k++) {

    if(layers.objectAtIndex(k).class() == "MSLayerGroup" && (layers.objectAtIndex(k).isVisible()==0)){
      var hiddenLayers = layers.objectAtIndex(k).children();

      for(var g = 0; g < hiddenLayers.count(); g++){
        hiddenLayers.objectAtIndex(g).setIsVisible(false);
      }
    }

    if ((layers.objectAtIndex(k).class() == "MSTextLayer") && (layers.objectAtIndex(k).isVisible()!=0)) {
      var validColor = false;

      // all text properties are here : http://developer.sketchapp.com/reference/api/file/api/Text.js.html#lineNumber48
      var textColor = layers.objectAtIndex(k).textColor();
      var myRegexp = /\(r:(.*) g:(.*) b:(.*) a:(.*)\)/g;
      var colorValues = myRegexp.exec(textColor);

      // log("colorSetValueRgb:" +colorValues);

      // check color valid or not
      for (var l = 0; l < colorSetValueRgb.length; l++) {
        if( Math.round(parseFloat(colorValues[1])*255) == colorSetValueRgb[l][0] && Math.round(parseFloat(colorValues[2])*255) == colorSetValueRgb[l][1] && Math.round(parseFloat(colorValues[3])*255) == colorSetValueRgb[l][2]) {
          validColor = true;
          break;
        }
      }

      // log("validColor:" + validColor);
      // check text color
      if (!validColor) {
        layers.objectAtIndex(k).style().addStylePartOfType(1);
        layers.objectAtIndex(k).style().borders().objectAtIndex(0).setThickness(2);
        layers.objectAtIndex(k).style().borders().objectAtIndex(0).color().setRed(1);
        layers.objectAtIndex(k).style().borders().objectAtIndex(0).color().setGreen(0.13);
        layers.objectAtIndex(k).style().borders().objectAtIndex(0).color().setBlue(0.40);
        text = "wrong text layer";
      }
    }
  }

  if (text == '') {
    doc.showMessage("Well done 😎, no issues found.");
  } else {
    doc.showMessage("The layers marked in red have wrong fill colors, in yellow have wrong border colors. Happy fixing 😊");
  }
};

// ENTIRE FILE AT ONCE. DISCUSS IF THESE MAKE SENSE
function check_ForFontSizeAll(context, fontSizeSet) {
  var text = '',
      app = NSApplication.sharedApplication(),
      doc = context.document,
      documentName = doc.displayName(),
      pages = doc.pages();

  for (var i = 0; i < pages.length; i++) {
    if((pages[i].name()) == "Symbols"){
      break;
    }

    var validPage = true;
    var artboards = pages[i].artboards();
    
    for (var j = 0; j < artboards.length; j++) {
      var validArtboard = true;
      var layers = artboards[j].children();

      for (var k = 0; k < layers.count(); k++) {

        // log("class"+layers.objectAtIndex(k).class() + "        name :" + layers.objectAtIndex(k).name() + "       " + layers.objectAtIndex(k).isVisible());

        if(layers.objectAtIndex(k).class() == "MSLayerGroup" && (layers.objectAtIndex(k).isVisible()==0)){
          // log ("hidden groups :   " +layers.objectAtIndex(k).children());
          var hiddenLayers = layers.objectAtIndex(k).children();

          for(var g = 0; g < hiddenLayers.count(); g++){
            hiddenLayers.objectAtIndex(g).setIsVisible(false);
          }
        }

        if ((layers.objectAtIndex(k).class() == "MSTextLayer") && (layers.objectAtIndex(k).isVisible()!=0)) {
          var validFont = false;
          var validFontName = false;


          // all text properties are here : http://developer.sketchapp.com/reference/api/file/api/Text.js.html#lineNumber48
          // log("layer name" + layers.objectAtIndex(k));
          var textValue = layers.objectAtIndex(k).stringValue();

          // check font valid or not
          for (var l = 0; l < fontSizeSet.length; l++) {
            if (layers.objectAtIndex(k).fontSize() === fontSizeSet[l]) {
              validFont = true;
              break;
            }
          }

          for (var l = 0; l < fontSizeSet.length; l++) {
            if ((layers.objectAtIndex(k).font().fontName() == "CamphorStd-Bold") || (layers.objectAtIndex(k).font().fontName() == "CamphorStd-Regular")) {
              validFontName = true;
              break;
            }
          }

          // check text font
          if (!validFont) {
            if (validPage) {
              validPage = false;
              text += '\nPage: ' + pages[i].name() + '\n';
            }
            if (validArtboard) {
              validArtboard = false;
              text += '\nArtboard: ' + artboards[j].name() + '\n';
            }
            text += 'text size:  \"'  + layers.objectAtIndex(k).name() + '\"  ' + layers.objectAtIndex(k).fontSize() + "px" + '\n';
          }
          
          if (!validFontName) {
            if (validPage) {
              validPage = false;
              text += '\nPage: ' + pages[i].name() + '\n';
            }
            if (validArtboard) {
              validArtboard = false;
              text += '\nArtboard: ' + artboards[j].name() + '\n';
            }
            text += 'Font:  \"'  + layers.objectAtIndex(k).name() + '\"  ' + layers.objectAtIndex(k).font().fontName() + '\n';
          }

        }
      }
    }
  }

  if (text == '') {
    app.displayDialog_withTitle("Well done. 🙌", "No issues found." +"\n" );
  } else {
    app.displayDialog_withTitle(text, "These layers have wrong font sizes." +"\n"+"Happy fixing. 😇");
  }
};
