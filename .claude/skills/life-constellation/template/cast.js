// Life Constellation – the cast and the story.
// Edit this file for a new life; everything else reads from it.
//
// Ages are in years (my age). x is the horizontal position in px (0..1080).
// A path keyframe x can be a person id ("mama") = branch out of that person's line at that age.
//
// type:
//   family  – already there before I'm born          (path starts before age 0)
//   joins   – arrives at `from` and stays             (enter: "left" | "right" | "<id>")
//   crosses – passes through at `at`, straight across (dir: 1 = left→right, -1 = right→left)
// end (optional):
//   { leaves: age, side: "left" | "right" }           – the line bends off the screen
//   { star: age, bend: -1 | 1, sky: [x, y] }          – becomes a star at that spot
window.LC_CAST = {
  lang: "de",
  text: {
    axis: "Alter",
    title: "Das Leben ist eine Reise",
    subtitle: "Manche gehen ein Stück mit dir. Andere bleiben für immer an deinem Himmel.",
  },

  // The clock: video time ↔ my age. Relative speed (years per second) by age;
  // it is scaled so that birth lands at `birthAt` s and `endAge` at `lifeEnd` s.
  clock: {
    birthAt: 2,
    endAge: 85,
    lifeEnd: 116,
    speed: [
      [0, 0.42], [5, 0.48], [12, 0.55], [20, 0.62], [27, 0.7], [34, 1.1], [41, 1.35],
      [47, 1.0], [51, 1.15], [55, 1.0], [60, 1.4], [70, 1.4], [77, 0.85], [81, 0.6], [85, 0.45],
    ],
  },

  // The ending, in seconds after `lifeEnd` (when I become a star).
  ending: {
    fadeOld: [0.3, 2.3],      // axis and old lines fade out
    linesStart: 2.6,          // first constellation line
    lineEvery: 0.85,          // next line starts after …
    lineDraw: 0.75,           // … and takes this long to draw
    title: 7.8,               // "Life is a journey"
    rule: 8.8,
    subtitle: 9.6,
    black: 14.0,              // fade to black starts
    blackFor: 1.2,
  },

  me: "ich",
  child: "sohn",
  constellation: ["ich", "ehefrau", "mama", "oma", "opa", "papa", "ich"],

  people: [
    { id: "opa", name: "Opa", color: "#7FA8FF", type: "family",
      path: [[-3, 860], [2, 920], [9, 900], [14, 930]],
      end: { star: 14, bend: 1, sky: [400, 200] } },
    { id: "oma", name: "Oma", color: "#C9A7FF", type: "family",
      path: [[-3, 690], [2, 770], [10, 760], [15, 820], [22, 800]],
      end: { star: 22, bend: 1, sky: [800, 330] } },
    { id: "mama", name: "Mama", color: "#FF8FB8", type: "family",
      path: [[-3, 480], [0, 470], [2, 620], [12, 600], [22, 640], [25.5, 830], [45, 840], [55, 850]],
      end: { star: 55, bend: 1, sky: [850, 620] } },
    { id: "papa", name: "Papa", color: "#5FD4C8", type: "family",
      path: [[-3, 300], [2, 280], [10, 310], [20, 290], [30, 230], [40, 250], [47, 240]],
      end: { star: 47, bend: -1, sky: [220, 560] } },
    { id: "ich", name: "Ich", color: "#FFD36E", type: "joins", from: 0, enter: "mama",
      path: [[0, "mama"], [1.6, 450], [12, 460], [20, 480], [27, 440], [31, 420], [47, 400], [55, 410], [80, 420], [84, 440], [85, 440]] },

    { id: "kiga", name: "Kindergartenfreund", color: "#9BE8A8", type: "crosses", at: 4, dir: 1 },
    { id: "kindheit", name: "Kindheitsfreund", color: "#FF9F7A", type: "joins", from: 5, enter: "left",
      path: [[5, 150], [8, 170], [11, 150]],
      end: { leaves: 11, side: "left" } },
    { id: "grundschule", name: "Grundschulfreund", color: "#8FD3FF", type: "crosses", at: 8, dir: -1 },
    { id: "mittelstufe", name: "Mittelstufenfreund", color: "#C8F07A", type: "crosses", at: 13, dir: 1 },
    { id: "liebe", name: "Erste Liebe", color: "#FF6FD8", type: "crosses", at: 16, dir: -1 },
    { id: "oberstufe", name: "Oberstufenfreund", color: "#6FE6FF", type: "crosses", at: 18, dir: 1 },
    { id: "studium", name: "Studienfreund", color: "#FFB45E", type: "joins", from: 20, enter: "left",
      path: [[20, 140], [27, 130], [34, 130]],
      end: { leaves: 34, side: "left" } },
    { id: "ehefrau", name: "Ehefrau", color: "#FF6B7F", type: "joins", from: 26, enter: "right",
      path: [[26, 650], [31, 690], [47, 700], [55, 720], [80, 730]],
      end: { star: 80, bend: 1, sky: [780, 800] } },
    { id: "kollege", name: "Kollege", color: "#B8C4D6", type: "crosses", at: 29, dir: -1 },
    { id: "sohn", name: "Sohn", color: "#9FE0FF", type: "joins", from: 31, enter: "ich",
      path: [[31, "ich"], [33, 555], [47, 560], [55, 570], [80, 570], [84, 620], [100, 640]] },
  ],
};
