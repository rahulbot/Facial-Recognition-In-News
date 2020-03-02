// constants used throughout
WIDTH = 1100;
HEIGHT = 650;
STOP_WORDS = ["facial", "recognition", "detection", "tracking", "facial-recognition"];
WORDS_TO_SHOW = 20;
WORD_HEIGHT = 30;
WORD_PADDING = 10;

// helper function to remove stop words that were part of the search
function removeStopWords(wordList) {
  return wordList.filter(word => !STOP_WORDS.includes(word.term));
}

function wordNodeId(country, term) {
  return country+'-'+term;
}

// https://stackoverflow.com/questions/12115691/svg-d3-js-rounded-corner-on-one-corner-of-a-rectangle
function rightRoundedRect(x, y, width, height, radius) {
  return "M" + x + "," + y
       + "h" + (width - radius)
       + "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius
       + "v" + (height - 2 * radius)
       + "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius
       + "h" + (radius - width)
       + "z";
}

// when the page loads, render everything
$(function() {

  // request all the data
  Promise.all([
    d3.csv("/data/india-words.csv"),
    d3.csv("/data/nigeria-words.csv"),
    d3.csv("/data/uk-words.csv"),
    d3.csv("/data/usa-words.csv"),
  ]).then(function(data) {

    // parse all the data in nicer forms
    topWords = [];
    topWords[0] = {
      countryName: 'India',
      words: removeStopWords(data[0]).slice(0,WORDS_TO_SHOW),
    };
    topWords[1] = {
      countryName: 'Nigeria',
      words: removeStopWords(data[1]).slice(0,WORDS_TO_SHOW),
    };
    topWords[2] = {
      countryName: 'UK',
      words: removeStopWords(data[2]).slice(0,WORDS_TO_SHOW),
    };
    topWords[3] = {
      countryName: 'USA',
      words: removeStopWords(data[3]).slice(0,WORDS_TO_SHOW),
    };
    //console.log(topWords);

    // render all the words as columns
    var baseSvg = d3.select("#word-viz").append("svg")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
    for(i=0;i<topWords.length;i++) {
      countryName = topWords[i].countryName;
      baseSvg.append("g")
        .attr("id", countryName + "-title")
        .attr("transform",
          "translate(" + (WIDTH/topWords.length)*i + ",0)")
          .append("text")
            .attr("x", 0)
            .attr("y", 20)
            .text(countryName)
              .attr("font-family", "sans-serif")
              .attr("font-weight", "bold")
              .attr("font-size", "20px")
              .attr("fill", "black");
      column = baseSvg.append("g")
        .attr("id", countryName + "-words")
        .attr("transform",
          "translate(" + (WIDTH/topWords.length)*i + ",0)");
      column.selectAll("text")
        .data(topWords[i]['words'])
        .enter()
        .append("text")
          .attr("x", 0)
          .attr("y", (d,i) => 60 + i*WORD_HEIGHT)
          .attr("class", d => "term "+d.term)
          .on('mouseover', d => {
            d3.selectAll(".term").classed("inactive", true);
            d3.selectAll(".term").classed("active", false);
            d3.selectAll(".term."+d.term).classed("inactive", false);
            d3.selectAll(".term."+d.term).classed("active", true);
            d3.selectAll("path").classed("inactive", true);
            d3.selectAll("path").classed("active", false);
            d3.selectAll("path."+d.term).classed("inactive", false);
            d3.selectAll("path."+d.term).classed("active", true);
          })
          .on('mouseout', d => {
            d3.selectAll(".term").classed("inactive", false);
            d3.selectAll(".term").classed("active", false);
            d3.selectAll("path").classed("inactive", false);
            d3.selectAll("path").classed("active", false);
          })
          .text(d => d.term)
            .attr("font-family", "serif")
            .attr("font-size", "16px")
            .attr("fill", "black")
            .attr("id", d => wordNodeId(countryName,d.term));
    }

    // figure out links between words and render lines connecting them
    allWords = d3.set(topWords.map(country => country.words.map(w => w.term)).reduce((combination, item) => combination.concat(item))).values();
    wordLinks = allWords.map(word => {
      links = [];
      for (idx=0; idx<topWords.length; idx++) {
        countryWords = topWords[idx].words.map(w => w.term);
        if (countryWords.includes(word)) {
          links.push({
            country: topWords[idx].countryName,
            countryIndex: idx,
            word: word,
            wordIndex: countryWords.indexOf(word),
          })
        }
      }
      return links;
    });
    // add in locations of each word
    wrapperOffset = $('#word-viz').offset();
    paths = wordLinks.map(links => {
      wordPaths = []
      for (idx=0;idx<links.length-1;idx++) {
        sourceWord = links[idx];
        targetWord = links[idx+1];
        sourceElem = $("#"+wordNodeId(sourceWord.country, sourceWord.word));
        targetElem = $("#"+wordNodeId(targetWord.country, targetWord.word));
        path = {
          source: {
            x: sourceElem.offset().left - wrapperOffset.left + $(sourceElem)[0].getBBox().width + WORD_PADDING,
            y: (sourceElem.offset().top - wrapperOffset.top) + (WORD_HEIGHT / 3)
          },
          target: {
            x: targetElem.offset().left - wrapperOffset.left - WORD_PADDING,
            y: (targetElem.offset().top - wrapperOffset.top) + (WORD_HEIGHT / 3)
          },
          term: sourceWord.word,
        }
        wordPaths.push(path);
      }
      return wordPaths;
    });
    paths = paths.reduce((accumulator, item) => accumulator.concat(item));

    // draw lines between the same word in each column
    termsWithLinks = d3.shuffle(d3.set(paths.map(p => p.term)).values())
    var color = d3.scaleOrdinal(d3.schemeCategory10);
    function linkVertical(d) {
      // https://github.com/d3/d3-shape/issues/27#issuecomment-256784743
      return "M" + d.source.x + "," + d.source.y
          + "C" + (d.source.x + d.target.x) / 2 + "," + d.source.y
          + " " + (d.source.x + d.target.x) / 2 + "," + d.target.y
          + " " + d.target.x + "," + d.target.y;
    }
    baseSvg.append("g")
      .attr("id", "word-links")
      .selectAll(".link")
      .data(paths)
      .enter()
        .append("path")
        .attr("class", d => "link "+d.term)
        .attr("stroke", d => color(termsWithLinks.indexOf(d.term)))
        .attr("stroke-width", "1")
        .attr("fill", "none")
        .attr("d", linkVertical);

  });

});