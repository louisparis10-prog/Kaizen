// Remplissage des vraies trames SWM (.pptx).
//
// Un .pptx est une archive ZIP contenant du XML. On ouvre la trame d'origine,
// on ecrit les reponses dans les cases prevues, puis on re-zippe : le fichier
// obtenu est la trame SWM elle-meme, deja renseignee et modifiable dans PowerPoint.
//
// Les cases sont reperees par leurs coordonnees (attribut <a:off x= y=/>), relevees
// une fois pour toutes dans chaque trame : c'est stable tant que la trame ne bouge pas.
const fs = require('fs');
const path = require('path');

const DOSSIER_TRAMES = path.join(__dirname, '..', 'public', 'templates');

// jszip est charge a la demande : si la dependance manque, seule cette
// fonctionnalite echoue, le reste de l'application continue de tourner.
function chargerJSZip() {
  try {
    return require('jszip');
  } catch (err) {
    throw new Error("La bibliotheque de lecture PowerPoint (jszip) n'est pas installee sur le serveur");
  }
}

function escXml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Decoupe le XML en blocs <p:sp>...</p:sp> et applique une transformation au bloc
// dont le <a:off> correspond aux coordonnees demandees.
function modifierForme(xml, x, y, transformer) {
  const blocs = xml.split('<p:sp>');
  let trouve = false;
  for (let i = 1; i < blocs.length; i++) {
    const cible = `<a:off x="${x}" y="${y}"/>`;
    if (blocs[i].indexOf(cible) === -1) continue;
    const modifie = transformer(blocs[i]);
    if (modifie !== null) { blocs[i] = modifie; trouve = true; }
    break;
  }
  return { xml: blocs.join('<p:sp>'), trouve };
}

// Construit les paragraphes PowerPoint correspondant a un texte (une ligne = un <a:p>).
function paragraphes(texte, rPr) {
  const lignes = String(texte).split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lignes.length) return '';
  return lignes.map(ligne =>
    `<a:p><a:r>${rPr}<a:t>${escXml(ligne)}</a:t></a:r></a:p>`
  ).join('');
}

// Ecrit un texte dans une case vide : on remplace le contenu du <p:txBody> en
// conservant <a:bodyPr> et <a:lstStyle> (mise en forme de la case d'origine).
// Renvoie { xml, trouve } pour pouvoir signaler une saisie qui n'a pas trouve sa case.
function ecrireDansCase(xml, x, y, texte) {
  if (!texte || !String(texte).trim()) return { xml, trouve: true };
  return modifierForme(xml, x, y, bloc => {
    const debut = bloc.indexOf('<p:txBody>');
    const fin = bloc.indexOf('</p:txBody>');
    if (debut === -1 || fin === -1) return null;

    const corps = bloc.slice(debut + '<p:txBody>'.length, fin);
    // On reprend le rPr de fin de paragraphe : il porte la police et la taille voulues.
    const mEnd = corps.match(/<a:endParaRPr[^>]*\/>/);
    let rPr = '<a:rPr lang="fr-FR" dirty="0"/>';
    if (mEnd) rPr = mEnd[0].replace('<a:endParaRPr', '<a:rPr').replace(/\/>$/, '/>');

    const mBody = corps.match(/<a:bodyPr[^>]*(\/>|>[\s\S]*?<\/a:bodyPr>)/);
    const mList = corps.match(/<a:lstStyle[^>]*(\/>|>[\s\S]*?<\/a:lstStyle>)/);
    const entete = (mBody ? mBody[0] : '<a:bodyPr/>') + (mList ? mList[0] : '<a:lstStyle/>');

    return bloc.slice(0, debut) + '<p:txBody>' + entete + paragraphes(texte, rPr) +
      '</p:txBody>' + bloc.slice(fin + '</p:txBody>'.length);
  });
}

// Certaines trames n'ont aucune case a un endroit ou l'utilisateur doit pourtant
// ecrire (colonnes I/O/C du SIPOC, probleme des 5 Pourquoi...). On y ajoute alors
// une zone de texte, positionnee sur la zone prevue de la trame.
function ajouterZoneTexte(xml, zone, texte) {
  if (!texte || !String(texte).trim()) return xml;
  const idUnique = 9000 + Math.floor(Math.random() * 900);
  const taille = zone.taille || 1100;
  const corps = String(texte).split(/\r?\n/).filter(l => l.trim() !== '')
    .map(l => `<a:p><a:r><a:rPr lang="fr-FR" sz="${taille}" dirty="0"/><a:t>${escXml(l)}</a:t></a:r></a:p>`)
    .join('');

  const forme = `<p:sp><p:nvSpPr>` +
    `<p:cNvPr id="${idUnique}" name="Saisie ${escXml(zone.id)}"/>` +
    `<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${zone.x}" y="${zone.y}"/><a:ext cx="${zone.cx}" cy="${zone.cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="45720" tIns="45720" rIns="45720" bIns="45720"` +
    `${zone.ancrage ? ` anchor="${zone.ancrage}"` : ''}>` +
    `<a:normAutofit/></a:bodyPr><a:lstStyle/>${corps}</p:txBody></p:sp>`;

  return xml.replace('</p:spTree>', forme + '</p:spTree>');
}

// Entetes du type "Animateur : ______" : on remplace les traits par la valeur saisie.
function remplirLigneEntete(xml, x, y, libelle, valeur) {
  if (!valeur || !String(valeur).trim()) return xml;
  return modifierForme(xml, x, y, bloc => {
    if (bloc.indexOf(libelle) === -1) return null;
    let remplace = false;
    const nouveau = bloc.replace(/<a:t>([^<]*)<\/a:t>/g, (tout, contenu) => {
      if (remplace || !/^[_\s]+$/.test(contenu) || contenu.indexOf('_') === -1) return tout;
      remplace = true;
      return `<a:t> ${escXml(valeur)}</a:t>`;
    });
    return remplace ? nouveau : null;
  }).xml;
}

// Ecrit dans une cellule du tableau (ligne et colonne comptees a partir de 0,
// ligne 0 = entete du tableau).
function ecrireDansCellule(xml, ligne, colonne, texte) {
  if (!texte || !String(texte).trim()) return xml;
  const lignes = xml.split('<a:tr ');
  if (ligne + 1 >= lignes.length) return xml;

  const cellules = lignes[ligne + 1].split('</a:tc>');
  if (colonne >= cellules.length - 1) return xml;

  cellules[colonne] = cellules[colonne].replace(/<a:txBody>[\s\S]*?<\/a:txBody>/, corps => {
    const mEnd = corps.match(/<a:endParaRPr[^>]*\/>/);
    let rPr = '<a:rPr lang="fr-FR" dirty="0"/>';
    if (mEnd) rPr = mEnd[0].replace('<a:endParaRPr', '<a:rPr');
    const mBody = corps.match(/<a:bodyPr[^>]*(\/>|>[\s\S]*?<\/a:bodyPr>)/);
    return '<a:txBody>' + (mBody ? mBody[0] : '<a:bodyPr/>') + '<a:lstStyle/>' +
      paragraphes(texte, rPr) + '</a:txBody>';
  });

  lignes[ligne + 1] = cellules.join('</a:tc>');
  return lignes.join('<a:tr ');
}

// ---------- Correspondance champ du formulaire -> case de la trame ----------
// Coordonnees relevees directement dans le XML de chaque trame SWM.
const TRAMES = {
  'ishikawa': {
    fichier: 'ishikawa-swm.pptx',
    entetes: [
      { id: 'chantier', x: 6548954, y: 174157, libelle: 'Chantier' },
      { id: 'date', x: 6548954, y: 174157, libelle: 'Date' }
    ],
    cases: [],
    // La trame ne prevoit pas de case le long des aretes : on pose une zone de
    // texte sous chaque etiquette haute, et au-dessus de chaque etiquette basse
    // (ancrage bas, pour que le texte reste colle a son arete).
    zonesTexte: [
      { id: 'main_oeuvre', x: 1121135, y: 1680000, cx: 2300000, cy: 930000, taille: 900 },
      { id: 'materiel', x: 3940321, y: 1680000, cx: 2300000, cy: 930000, taille: 900 },
      { id: 'machine', x: 6786609, y: 1680000, cx: 2300000, cy: 930000, taille: 900 },
      { id: 'milieu', x: 1507762, y: 4700000, cx: 2300000, cy: 930000, taille: 900, ancrage: 'b' },
      { id: 'methode', x: 4329659, y: 4700000, cx: 2300000, cy: 930000, taille: 900, ancrage: 'b' },
      { id: 'mesure', x: 7166389, y: 4700000, cx: 2300000, cy: 930000, taille: 900, ancrage: 'b' },
      // Tete du poisson : sous l'etiquette "Probleme", a l'interieur du cadre arrondi.
      { id: 'probleme', x: 10010000, y: 4130000, cx: 1420000, cy: 1350000, taille: 900 }
    ]
  },

  'matrice-gain-effort': {
    fichier: 'matrice-gain-effort-swm.pptx',
    entetes: [
      { id: 'chantier', x: 6548954, y: 174157, libelle: 'Chantier' },
      { id: 'date', x: 6548954, y: 174157, libelle: 'Date' }
    ],
    cases: [],
    // La matrice est une image (a 1115569, 1291074, de 8181422 x 5240723) : les
    // quatre cadres blancs sont reperes par leur position relative dans l'image,
    // puis chaque solution est posee dans le cadre correspondant a son couple
    // Gain / Effort.
    quadrants: {
      champ: 'solutions',
      texte: 'solution',
      zones: [
        { gain: 'Eleve', effort: 'Faible', x: 2023711, y: 1742684, cx: 3280742, cy: 1580883 },
        { gain: 'Eleve', effort: 'Eleve', x: 5721714, y: 1742684, cx: 3280742, cy: 1580883 },
        { gain: 'Faible', effort: 'Faible', x: 2023711, y: 4001436, cx: 3280742, cy: 1586124 },
        { gain: 'Faible', effort: 'Eleve', x: 5721714, y: 4001436, cx: 3280742, cy: 1586124 }
      ]
    }
  },

  '5-pourquoi': {
    fichier: '5-pourquoi-swm.pptx',
    entetes: [
      { id: 'animateur', x: 6548954, y: 174157, libelle: 'Animateur' },
      { id: 'secteur', x: 6548954, y: 174157, libelle: 'Secteur' },
      { id: 'date', x: 6548954, y: 174157, libelle: 'Date' }
    ],
    cases: [],
    // Une colonne par "Pourquoi". Un niveau peut avoir plusieurs causes : chaque
    // ligne saisie va dans une case distincte de la colonne, de haut en bas.
    colonnes: [
      { id: 'pourquoi1', positions: [
        { x: 190129, y: 2172826 }, { x: 190129, y: 3554617 }, { x: 190129, y: 4904617 }
      ] },
      { id: 'pourquoi2', positions: [
        { x: 2603218, y: 1754617 }, { x: 2603218, y: 2654617 }, { x: 2603218, y: 3554617 },
        { x: 2603218, y: 4454617 }, { x: 2603218, y: 5354617 }
      ] },
      { id: 'pourquoi3', positions: [
        { x: 5016307, y: 1754617 }, { x: 5016307, y: 2654617 }, { x: 5016307, y: 3554617 },
        { x: 5016307, y: 4454617 }, { x: 5016307, y: 5354617 }
      ] },
      { id: 'pourquoi4', positions: [
        { x: 7400730, y: 1754617 }, { x: 7400730, y: 2654617 }, { x: 7400730, y: 3554617 },
        { x: 7400730, y: 4454617 }, { x: 7400730, y: 5354617 }
      ] },
      { id: 'pourquoi5', positions: [
        { x: 9813819, y: 1754617 }, { x: 9813819, y: 2654617 }, { x: 9813819, y: 3554617 },
        { x: 9813819, y: 4454617 }, { x: 9813819, y: 5354617 }
      ] }
    ],
    // La trame n'a pas de case pour le probleme de depart : on l'ajoute au-dessus
    // des colonnes, dans la bande libre entre le titre et les fleches numerotees.
    zonesTexte: [
      { id: 'probleme', x: 190129, y: 560000, cx: 6100000, cy: 400000, taille: 1200 }
    ]
  },

  'qqoqccp': {
    fichier: 'qqoqccp-swm.pptx',
    entetes: [
      { id: 'animateur', x: 6548954, y: 194082, libelle: 'Animateur' },
      { id: 'secteur', x: 6548954, y: 194082, libelle: 'Secteur' },
      { id: 'date', x: 6548954, y: 194082, libelle: 'Date' }
    ],
    cases: [
      { id: 'quoi', x: 1794721, y: 1013281 },
      { id: 'qui', x: 1794720, y: 2455478 },
      { id: 'ou', x: 1794720, y: 3906577 },
      { id: 'quand', x: 1794720, y: 5360654 },
      { id: 'combien', x: 7770281, y: 2455478 },
      { id: 'comment', x: 7770281, y: 3906577 },
      { id: 'pourquoi', x: 7770281, y: 5360654 }
    ]
  },

  'sipoc': {
    fichier: 'sipoc-swm.pptx',
    entetes: [],
    cases: [],
    // Les cinq colonnes n'ont pas de case de saisie : on ecrit une ligne par ligne
    // du tableau, pour que le texte suive les lignes imprimees au lieu de s'entasser
    // en haut. La colonne Processus demarre apres les pastilles numerotees, qui
    // s'arretent a x=5272430.
    lignesY: [1517904, 1883664, 2249424, 2615184, 2980944, 3346704, 3712464, 4078224],
    hauteurLigne: 365760,
    colonnesTexte: [
      { id: 'suppliers', x: 151440, cx: 2200000 },
      { id: 'inputs', x: 2572771, cx: 2200000 },
      { id: 'process', x: 5330000, cx: 1880000 },
      { id: 'outputs', x: 7415433, cx: 2200000 },
      { id: 'customers', x: 9836764, cx: 2200000 }
    ],
    zonesTexte: [
      // Bandeau bas : indicateurs et voix du client (4e colonne du bandeau).
      { id: 'ind_exigences', x: 2554483, y: 5035296, cx: 2170000, cy: 1150000, taille: 900 },
      { id: 'ind_pilotage', x: 4975814, y: 5035296, cx: 2170000, cy: 1150000, taille: 900 },
      { id: 'ind_resultats', x: 7397145, y: 5035296, cx: 2170000, cy: 1150000, taille: 900 },
      { id: 'voix_client', x: 9818476, y: 5035296, cx: 2170000, cy: 1150000, taille: 900 },
      // Cartouche bas gauche : la valeur est ecrite sous son intitule.
      { id: 'processus', x: 182880, y: 4948000, cx: 2183587, cy: 215000, taille: 700 },
      { id: 'responsable', x: 182880, y: 5310000, cx: 2183587, cy: 215000, taille: 700 },
      { id: 'date', x: 182880, y: 5673000, cx: 2183587, cy: 215000, taille: 700 },
      { id: 'revision', x: 182880, y: 6036000, cx: 2183587, cy: 215000, taille: 700 }
    ]
  },

  '7-gaspillages': {
    fichier: 'chasse-aux-mudas-swm.pptx',
    entetes: [
      { id: 'date', x: 5650992, y: 256032, libelle: 'Date' },
      { id: 'secteur', x: 7438644, y: 256032, libelle: 'Secteur' },
      { id: 'equipe', x: 5650992, y: 512064, libelle: 'quipe' },
      { id: 'animateur', x: 7438644, y: 539496, libelle: 'Animateur' }
    ],
    cases: [],
    // Tableau "Releve des gaspillages" : 10 lignes numerotees, 6 colonnes.
    tableau: {
      champ: 'gaspillages',
      lignesMax: 10,
      colonnes: { type: 1, zone: 2, probleme: 3, impact: 4 }
    }
  }
};

// ---------- Trames au format PDF ----------
// L'Ishikawa SWM est un PDF (diapositive 960 x 540 points, origine en bas a gauche)
// sans champ de formulaire : on ecrit donc par-dessus, aux emplacements releves
// dans le fichier lui-meme a partir de la position de ses etiquettes.
// Aucune trame PDF pour le moment : les six supports SWM sont des .pptx.
const TRAMES_PDF = {};

// La police standard des PDF ne connait qu'un jeu de caracteres limite : on
// remplace ce qui n'en fait pas partie plutot que d'echouer a la generation.
function nettoyerPourPdf(texte) {
  return String(texte == null ? '' : texte)
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

async function remplirPdf(toolId, headerValues, fieldValues) {
  const trame = TRAMES_PDF[toolId];
  let PDFDocument, StandardFonts, rgb;
  try {
    ({ PDFDocument, StandardFonts, rgb } = require('pdf-lib'));
  } catch (err) {
    throw new Error("La bibliotheque de lecture PDF (pdf-lib) n'est pas installee sur le serveur");
  }

  const pdf = await PDFDocument.load(fs.readFileSync(path.join(DOSSIER_TRAMES, trame.fichier)));
  const page = pdf.getPages()[0];
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const encre = rgb(0.06, 0.14, 0.24);

  function ecrire(texte, x, y, largeur, taille) {
    const t = nettoyerPourPdf(texte).trim();
    if (!t) return;
    page.drawText(t, {
      x, y, size: taille || 8, font: police, color: encre,
      maxWidth: largeur, lineHeight: (taille || 8) + 3
    });
  }

  (trame.entetes || []).forEach(e => ecrire((headerValues || {})[e.id], e.x, e.y, e.largeur || 300, e.taille));

  (trame.branches || []).forEach(b => {
    // Une cause par ligne, empilees vers le bas depuis le point de depart.
    const causes = String((fieldValues || {})[b.id] || '')
      .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    causes.forEach((cause, i) => ecrire('- ' + cause, b.x, b.y - i * 22, b.largeur, 8));
  });

  if (trame.effet) {
    ecrire((fieldValues || {})[trame.effet.id], trame.effet.x, trame.effet.y,
      trame.effet.largeur, trame.effet.taille);
  }

  const destinations = new Set([
    ...(trame.entetes || []).map(e => e.id),
    ...(trame.branches || []).map(b => b.id),
    trame.effet ? trame.effet.id : null
  ].filter(Boolean));
  const nonPlaces = Object.entries(fieldValues || {})
    .filter(([id, v]) => String(v || '').trim() && !destinations.has(id))
    .map(([id]) => id);

  return { buffer: Buffer.from(await pdf.save()), nonPlaces, lignesIgnorees: 0, causesEnTrop: [], extension: 'pdf' };
}

function trameDisponible(toolId) {
  return Boolean(TRAMES[toolId] || TRAMES_PDF[toolId]);
}

// Renvoie le .pptx rempli sous forme de Buffer.
async function remplir(toolId, headerValues, fieldValues) {
  if (TRAMES_PDF[toolId]) return remplirPdf(toolId, headerValues, fieldValues);

  const trame = TRAMES[toolId];
  if (!trame) throw new Error(`Aucune trame SWM remplissable pour l'outil ${toolId}`);

  const JSZip = chargerJSZip();
  const chemin = path.join(DOSSIER_TRAMES, trame.fichier);
  const zip = await JSZip.loadAsync(fs.readFileSync(chemin));
  const cheminSlide = 'ppt/slides/slide1.xml';
  let xml = await zip.file(cheminSlide).async('string');

  // Toute saisie qui ne trouve pas sa place est signalee : mieux vaut prevenir
  // que rendre une trame amputee sans que personne ne s'en apercoive.
  const nonPlaces = [];
  let lignesIgnorees = 0;

  (trame.entetes || []).forEach(e => {
    xml = remplirLigneEntete(xml, e.x, e.y, e.libelle, (headerValues || {})[e.id]);
  });

  (trame.cases || []).forEach(c => {
    const valeur = (fieldValues || {})[c.id];
    const res = ecrireDansCase(xml, c.x, c.y, valeur);
    xml = res.xml;
    if (!res.trouve && valeur && String(valeur).trim()) nonPlaces.push(c.id);
  });

  // Colonnes a plusieurs cases : une ligne saisie par case, de haut en bas.
  const causesEnTrop = [];
  (trame.colonnes || []).forEach(col => {
    const lignes = String((fieldValues || {})[col.id] || '')
      .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lignes.slice(0, col.positions.length).forEach((ligne, i) => {
      const res = ecrireDansCase(xml, col.positions[i].x, col.positions[i].y, ligne);
      xml = res.xml;
      if (!res.trouve) nonPlaces.push(col.id);
    });
    if (lignes.length > col.positions.length) {
      causesEnTrop.push(`${col.id} (${lignes.length - col.positions.length})`);
    }
  });

  // Une zone de texte peut porter une rubrique ou un champ d'entete (cartouche du SIPOC).
  const valeurs = { ...(headerValues || {}), ...(fieldValues || {}) };
  (trame.zonesTexte || []).forEach(z => {
    xml = ajouterZoneTexte(xml, z, valeurs[z.id]);
  });

  // Colonnes d'un tableau imprime : une ligne saisie par ligne du tableau, pour que
  // le texte suive les lignes au lieu de s'entasser en haut de la colonne.
  (trame.colonnesTexte || []).forEach(col => {
    const lignes = String(valeurs[col.id] || '')
      .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lignes.slice(0, trame.lignesY.length).forEach((ligne, i) => {
      xml = ajouterZoneTexte(xml, {
        id: `${col.id}-${i}`, x: col.x, y: trame.lignesY[i],
        cx: col.cx, cy: trame.hauteurLigne, taille: 900, ancrage: 'ctr'
      }, ligne);
    });
    lignesIgnorees += Math.max(0, lignes.length - trame.lignesY.length);
  });

  // Matrice : chaque solution va dans le cadre correspondant a son Gain / Effort.
  if (trame.quadrants) {
    const q = trame.quadrants;
    const solutions = (fieldValues || {})[q.champ] || [];
    q.zones.forEach(z => {
      const textes = solutions
        .filter(s => (s.gain || '') === z.gain && (s.effort || '') === z.effort)
        .map(s => String(s[q.texte] || '').trim())
        .filter(Boolean)
        .map(t => '- ' + t);
      if (textes.length) {
        xml = ajouterZoneTexte(xml,
          { id: `quadrant-gain-${z.gain}-effort-${z.effort}`, x: z.x, y: z.y, cx: z.cx, cy: z.cy, taille: 1000 },
          textes.join('\n'));
      }
    });
  }


  if (trame.tableau) {
    const lignes = (fieldValues || {})[trame.tableau.champ] || [];
    lignesIgnorees = Math.max(0, lignes.length - trame.tableau.lignesMax);
    lignes.slice(0, trame.tableau.lignesMax).forEach((ligne, i) => {
      Object.entries(trame.tableau.colonnes).forEach(([champ, colonne]) => {
        // +1 : la ligne 0 du tableau est son entete.
        xml = ecrireDansCellule(xml, i + 1, colonne, ligne[champ]);
      });
    });
  }

  // Champs saisis pour lesquels la trame n'offre aucune destination.
  const destinations = new Set([
    ...(trame.cases || []).map(c => c.id),
    ...(trame.colonnes || []).map(c => c.id),
    ...(trame.zonesTexte || []).map(z => z.id),
    ...(trame.tableau ? [trame.tableau.champ] : []),
    ...(trame.quadrants ? [trame.quadrants.champ] : [])
  ]);
  Object.entries(fieldValues || {}).forEach(([id, valeur]) => {
    const rempli = Array.isArray(valeur) ? valeur.length : String(valeur || '').trim();
    if (rempli && !destinations.has(id)) nonPlaces.push(id);
  });

  zip.file(cheminSlide, xml);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, nonPlaces: [...new Set(nonPlaces)], lignesIgnorees, causesEnTrop, extension: 'pptx' };
}

module.exports = { remplir, trameDisponible, TRAMES };
