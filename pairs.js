// Nano Wiki Race — pairs.
// Hand-written seed pairs so the game runs before tools/find-paths.html has
// been used. `shortest` paths here are plausible guesses; replace them with
// a generated pairs.js once you've run the path-finder tool.
//
// Fields per pair:
//   start, target, shortest  — the race itself
//   fact                     — one-sentence "why this is nano"
//   emoji                    — fallback glyph if image is missing / slow
//   size                     — short display string, e.g. "~200 nm"
//   scaleLabel               — one-line descriptor of what the size measures
//   image                    — path to a bundled image (or any URL — optional)
//   imagePage                — Commons file page URL for attribution (optional)
//   imageAuthor              — author string for attribution (optional)
//   imageLicense             — license string, e.g. "CC BY-SA 3.0" (optional)
//   startMeters, targetMeters — numeric sizes in meters, for scale-bar plotting
//   targetSize               — short display string for the target dot, e.g. "~10 m long"
//   targetLabel              — short descriptor of what the target measurement is of,
//                              e.g. "dinosaur length" (parallels scaleLabel on the start side)
//
// The shipped images under /images/ are redistributed from Wikimedia Commons
// under CC BY-SA 3.0. If you swap in your own images, keep the attribution
// fields filled in so the credit line stays visible on the info screen.
window.NWR_PAIRS = [
  {
    start: "Gecko",
    target: "Dinosaur",
    shortest: ["Gecko", "Reptile", "Dinosaur"],
    fact: "Geckos stick to walls using millions of nanoscale hairs on their toes!",
    emoji: "🦎",
    size: "~200 nm",
    scaleLabel: "gecko toe hair tip",
    startMeters: 2e-7,
    targetMeters: 10,
    targetSize: "~10 m",
    targetLabel: "dinosaur length",
    image: "images/gecko-toe.jpg",
    imagePage: "https://commons.wikimedia.org/wiki/File:Micro_and_nano_view_of_gecko%27s_toe.jpg",
    imageAuthor: "Autumn, K",
    imageLicense: "CC BY-SA 3.0",
  },
  {
    start: "Graphene",
    target: "Sun",
    shortest: ["Graphene", "Light", "Sun"],
    fact: "Graphene is a single layer of carbon atoms — a million times thinner than a human hair!",
    emoji: "⬢",
    size: "~0.3 nm",
    scaleLabel: "one carbon atom thick",
    startMeters: 3e-10,
    targetMeters: 1.4e9,
    targetSize: "1.4 million km",
    targetLabel: "Sun diameter",
    image: "images/graphene.jpg",
    imagePage: "https://commons.wikimedia.org/wiki/File:Graphen.jpg",
    imageAuthor: "AlexanderAlUS",
    imageLicense: "CC BY-SA 3.0",
  },
  {
    start: "DNA",
    target: "Blue whale",
    shortest: ["DNA", "Animal", "Blue whale"],
    fact: "Your DNA is only about 2 nanometers wide, but it would stretch 2 meters long!",
    emoji: "🧬",
    size: "~2 nm",
    scaleLabel: "DNA double helix width",
    startMeters: 2e-9,
    targetMeters: 30,
    targetSize: "~30 m",
    targetLabel: "blue whale length",
    image: "images/dna.png",
    imagePage: "https://commons.wikimedia.org/wiki/File:DNA_Structure%2BKey%2BLabelled.pn_NoBB.png",
    imageAuthor: "Zephyris",
    imageLicense: "CC BY-SA 3.0",
  },
  {
    start: "Butterfly",
    target: "Volcano",
    shortest: ["Butterfly", "Mesoamerica", "Volcano"],
    fact: "Some butterfly colors aren't pigment at all — nanoscale ridges on the scales bend light into shimmering blues.",
    emoji: "🦋",
    size: "~100 nm",
    scaleLabel: "wing scale ridges",
    startMeters: 1e-7,
    targetMeters: 2000,
    targetSize: "~2 km",
    targetLabel: "volcano height",
    image: "images/butterfly.jpg",
    imagePage: "https://commons.wikimedia.org/wiki/File:Morpho_sulkowskyi_wings.jpg",
    imageAuthor: "Radislav A. Potyrailo et al.",
    imageLicense: "CC BY 4.0",
  },
  {
    start: "Lotus effect",
    target: "Ocean",
    shortest: ["Lotus effect", "Epicuticular wax", "Ocean"],
    fact: "Lotus leaves stay clean thanks to nanoscale bumps that make water bead up and roll off!",
    emoji: "🪷",
    size: "~100 nm",
    scaleLabel: "lotus leaf bumps",
    startMeters: 1e-7,
    targetMeters: 1e7,
    targetSize: "~15,000 km",
    targetLabel: "Pacific Ocean width",
    image: "images/lotus-leaf.jpg",
    imagePage: "https://commons.wikimedia.org/wiki/File:Lotus_effect_on_leaf_of_taro_and_leaf_magnify.jpg",
    imageAuthor: "Namazu-tron",
    imageLicense: "CC BY-SA 3.0",
  },
];
