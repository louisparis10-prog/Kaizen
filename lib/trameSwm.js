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
function ecrireDansCase(xml, x, y, texte) {
  if (!texte || !String(texte).trim()) return xml;
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
  }).xml;
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
  '5-pourquoi': {
    fichier: '5-pourquoi-swm.pptx',
    entetes: [
      { id: 'animateur', x: 6548954, y: 174157, libelle: 'Animateur' },
      { id: 'secteur', x: 6548954, y: 174157, libelle: 'Secteur' },
      { id: 'date', x: 6548954, y: 174157, libelle: 'Date' }
    ],
    cases: [
      // Une colonne par "Pourquoi", on ecrit dans la premiere case de chaque colonne.
      { id: 'pourquoi1', x: 190129, y: 2172826 },
      { id: 'pourquoi2', x: 2603218, y: 1754617 },
      { id: 'pourquoi3', x: 5016307, y: 1754617 },
      { id: 'pourquoi4', x: 7400730, y: 1754617 },
      { id: 'pourquoi5', x: 9813819, y: 1754617 }
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
    cases: [
      { id: 'suppliers', x: 91440, y: 1517904 },
      { id: 'inputs', x: 2512771, y: 1517904 },
      { id: 'process', x: 4934102, y: 1517904 },
      { id: 'outputs', x: 7355433, y: 1517904 },
      { id: 'customers', x: 9776764, y: 1517904 }
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

function trameDisponible(toolId) {
  return Boolean(TRAMES[toolId]);
}

// Renvoie le .pptx rempli sous forme de Buffer.
async function remplir(toolId, headerValues, fieldValues) {
  const trame = TRAMES[toolId];
  if (!trame) throw new Error(`Aucune trame SWM remplissable pour l'outil ${toolId}`);

  const JSZip = chargerJSZip();
  const chemin = path.join(DOSSIER_TRAMES, trame.fichier);
  const zip = await JSZip.loadAsync(fs.readFileSync(chemin));
  const cheminSlide = 'ppt/slides/slide1.xml';
  let xml = await zip.file(cheminSlide).async('string');

  (trame.entetes || []).forEach(e => {
    xml = remplirLigneEntete(xml, e.x, e.y, e.libelle, (headerValues || {})[e.id]);
  });

  (trame.cases || []).forEach(c => {
    xml = ecrireDansCase(xml, c.x, c.y, (fieldValues || {})[c.id]);
  });

  if (trame.tableau) {
    const lignes = (fieldValues || {})[trame.tableau.champ] || [];
    lignes.slice(0, trame.tableau.lignesMax).forEach((ligne, i) => {
      Object.entries(trame.tableau.colonnes).forEach(([champ, colonne]) => {
        // +1 : la ligne 0 du tableau est son entete.
        xml = ecrireDansCellule(xml, i + 1, colonne, ligne[champ]);
      });
    });
  }

  zip.file(cheminSlide, xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { remplir, trameDisponible, TRAMES };
