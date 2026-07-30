// Bibliotheque des outils Lean / Kaizen.
// keywords: sert au moteur de chat local pour orienter vers le bon outil.

// Les 5 phases d'un chantier Kaizen. Identification / Analyse / Solution sont
// obligatoires (au moins 1 outil de chacune) pour creer un chantier ; Plan
// d'action et Standardisation sont recommandees mais pas obligatoires.
const PHASES = [
  { id: 'identification', order: 1, label: 'Identification', required: true, description: "Reperer et cadrer le probleme sur le terrain." },
  { id: 'analyse', order: 2, label: 'Analyse', required: true, description: "Comprendre les causes racines et quantifier le probleme." },
  { id: 'solution', order: 3, label: 'Solution', required: true, description: "Choisir et mettre en oeuvre la solution." },
  { id: 'plan-action', order: 4, label: "Plan d'action", required: false, description: "Planifier, piloter et suivre les actions." },
  { id: 'standardisation', order: 5, label: 'Standardisation et capitalisation', required: false, description: "Ancrer le gain dans la duree et capitaliser l'experience." }
];
const PHASES_BY_ID = Object.fromEntries(PHASES.map(p => [p.id, p]));

const TOOLS = [
  {
    id: '5s',
    name: '5S',
    icon: '🧹',
    category: 'Organisation',
    phase: 'solution',
    summary: "Methode d'organisation du poste de travail en 5 etapes : Trier, Ranger, Nettoyer, Standardiser, Maintenir.",
    whenToUse: [
      "Poste de travail encombre, desordonne ou dangereux",
      "Temps perdu a chercher des outils, pieces ou documents",
      "Avant de demarrer tout autre chantier Kaizen (base indispensable)",
      "Zone partagee par plusieurs equipes sans regles claires"
    ],
    steps: [
      "Seiri (Trier) : separer l'utile de l'inutile, evacuer ou marquer en zone rouge ce qui ne sert pas",
      "Seiton (Ranger) : une place pour chaque chose, chaque chose a sa place (marquage au sol, ombrage outils)",
      "Seiso (Nettoyer) : nettoyer et inspecter en meme temps pour reperer les anomalies (fuites, usures)",
      "Seiketsu (Standardiser) : definir des regles visuelles et un standard de rangement partage par tous",
      "Shitsuke (Maintenir) : auditer regulierement (checklist 5S) et ancrer la discipline dans les habitudes"
    ],
    benefits: "Gain de temps, reduction des risques, ambiance de travail plus saine, base indispensable avant SMED ou Standard Work.",
    memo: [
      "Seiri = TRIER : garder le strict necessaire",
      "Seiton = RANGER : une place, une chose, un nom",
      "Seiso = NETTOYER : nettoyer = inspecter",
      "Seiketsu = STANDARDISER : regle visuelle commune",
      "Shitsuke = MAINTENIR : audit regulier + discipline",
      "Astuce : zone rouge pour trier, marquage au sol pour ranger, checklist d'audit pour maintenir"
    ],
    keywords: ['5s', 'rangement', 'desordre', 'desordonne', 'encombre', 'encombrement', 'poste de travail sale', 'trier', 'ranger', 'nettoyer poste', 'organisation atelier', 'objets qui trainent', 'perte de temps a chercher', 'bazar', 'fouillis', 'pagaille', 'zone encombree', 'materiel egare', 'outils introuvables', 'outils perdus', 'poste inonde de pieces', 'allees encombrees', 'acces bloque', 'chute d\'objet', 'risque de trebuchement', 'zone de stockage desorganisee', 'gain de place', 'optimisation espace atelier', 'armoire mal rangee', 'etabli encombre', 'sol sale', 'zone de vie', 'management visuel poste', 'etiquetage poste', 'marquage au sol', 'ombrage outils', 'audit 5s', 'debarras', 'tri selectif atelier', 'placard en bazar', 'entrepot desordonne', 'stock mal range']
  },
  {
    id: 'pdca',
    name: 'PDCA (Roue de Deming)',
    icon: '🔄',
    category: 'Pilotage',
    phase: 'plan-action',
    summary: "Cycle d'amelioration continue en 4 phases : Plan, Do, Check, Act. Le fil conducteur de toute demarche Kaizen.",
    whenToUse: [
      "Pour structurer n'importe quelle demarche d'amelioration",
      "Pour piloter un chantier Kaizen du debut a la fin",
      "Pour eviter les actions correctives non suivies dans le temps"
    ],
    steps: [
      "Plan : analyser le probleme, fixer un objectif mesurable, definir un plan d'action",
      "Do : mettre en oeuvre les actions a petite echelle (essai pilote si possible)",
      "Check : mesurer les resultats et les comparer a l'objectif",
      "Act : si concluant, standardiser et generaliser ; sinon, ajuster et relancer un cycle"
    ],
    benefits: "Structure toute demarche d'amelioration, evite les actions ponctuelles sans suivi, cree une boucle d'apprentissage continue.",
    memo: [
      "P - Plan : je diagnostique et je planifie",
      "D - Do : je teste a petite echelle",
      "C - Check : je mesure vs objectif",
      "A - Act : je standardise ou je recommence",
      "Astuce : ne jamais sauter le Check, sinon la roue tourne dans le vide"
    ],
    keywords: ['pdca', 'roue de deming', 'demarche amelioration', 'plan do check act', 'methode generale', 'comment structurer', 'piloter un chantier', 'cycle d\'amelioration', 'boucle d\'amelioration continue', 'structurer un projet amelioration', 'suivre un plan d\'action', 'avant apres amelioration', 'demarche qualite', 'methode de resolution de probleme generale', 'processus d\'amelioration continue', 'comment m\'y prendre pour ameliorer', 'par ou commencer amelioration']
  },
  {
    id: 'ishikawa',
    name: 'Diagramme d\'Ishikawa (5M)',
    icon: '🐟',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Diagramme causes-effet en arete de poisson, structure autour des 5M : Main d'oeuvre, Methode, Materiel, Matiere, Milieu.",
    whenToUse: [
      "Probleme dont les causes racines ne sont pas evidentes",
      "Besoin de structurer un brainstorming de causes en groupe",
      "Defaut qualite ou panne recurrente a analyser collectivement"
    ],
    steps: [
      "Formuler clairement le probleme (l'effet) a droite du diagramme",
      "Tracer les 5 branches : Main d'oeuvre, Methode, Materiel, Matiere, Milieu",
      "Brainstormer les causes possibles sur chaque branche (technique du 'pourquoi' en soutien)",
      "Prioriser les causes les plus probables avec le groupe (vote, Pareto)",
      "Verifier les causes retenues sur le terrain avant de passer au plan d'action"
    ],
    benefits: "Vision exhaustive et partagee des causes possibles, evite de se focaliser trop vite sur une seule hypothese.",
    memo: [
      "5M : Main d'oeuvre, Methode, Materiel, Matiere, Milieu",
      "1 effet clairement defini a droite",
      "Brainstorm large avant de prioriser",
      "Combiner avec les 5 Pourquoi pour creuser chaque cause",
      "Toujours verifier sur le terrain (Gemba) avant d'agir"
    ],
    keywords: ['ishikawa', 'arete de poisson', 'diagramme causes', 'cause effet', '5m', 'cause racine', 'pourquoi le probleme arrive', 'panne recurrente', 'defaut qualite recurrent', 'diagramme causal', 'recherche de causes', 'brainstorming des causes', 'analyse multicritere probleme', 'main d\'oeuvre methode materiel matiere milieu', 'cause profonde', 'cause multiple', 'trouver l\'origine du probleme', 'analyse de defaillance', 'facteurs explicatifs probleme'],
    template: {
      file: 'templates/ishikawa-swm.pdf',
      label: 'Trame Ishikawa (support SWM)',
      usage: [
        "Imprimer ou projeter la trame : elle a deja les 6 branches tracees et le cadre \"Probleme\" a droite",
        "Remplir l'entete (Chantier, Date) avant de commencer",
        "Note : la trame SWM utilise 6 branches (Main d'oeuvre, Materiel, Machine, Milieu, Methode, Mesure) au lieu des 5M classiques",
        "Ecrire le probleme (l'effet) dans le cadre a droite",
        "En groupe, noter les causes possibles sur chaque branche au feutre",
        "Encadrer ou surligner la ou les causes retenues comme prioritaires avant de passer au plan d'action"
      ],
      header: [
        { id: 'chantier', label: 'Chantier', auto: 'titre' },
        { id: 'date', label: 'Date', auto: 'date_debut' }
      ],
      fields: [
        { id: 'probleme', label: 'Probleme (effet)', type: 'textarea', auto: 'probleme' },
        { id: 'main_oeuvre', label: "Main d'oeuvre", type: 'textarea' },
        { id: 'materiel', label: 'Materiel', type: 'textarea' },
        { id: 'machine', label: 'Machine', type: 'textarea' },
        { id: 'milieu', label: 'Milieu', type: 'textarea' },
        { id: 'methode', label: 'Methode', type: 'textarea' },
        { id: 'mesure', label: 'Mesure', type: 'textarea' }
      ]
    }
  },
  {
    id: '5-pourquoi',
    name: '5 Pourquoi',
    icon: '❓',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Technique qui consiste a demander 'Pourquoi ?' successivement (environ 5 fois) pour remonter jusqu'a la cause racine d'un probleme.",
    whenToUse: [
      "Probleme ponctuel ou simple a analyser rapidement",
      "Besoin d'aller vite avant de lancer des actions correctives",
      "En complement d'un Ishikawa pour creuser une cause identifiee"
    ],
    steps: [
      "Decrire le probleme de facon factuelle et precise",
      "Demander 'Pourquoi ce probleme se produit-il ?' et noter la reponse",
      "Reappliquer 'Pourquoi ?' a la reponse precedente, autant de fois que necessaire (souvent 5)",
      "S'arreter quand on atteint une cause agissable (sur laquelle on peut vraiment agir)",
      "Verifier la logique en remontant la chaine (si je corrige la derniere cause, le probleme disparait-il ?)"
    ],
    benefits: "Rapide, ne necessite pas d'outil, oblige a ne pas se contenter d'une cause superficielle.",
    memo: [
      "1 probleme factuel bien decrit au depart",
      "Repeter 'Pourquoi ?' jusqu'a la cause racine agissable",
      "5 est indicatif : parfois 3 suffisent, parfois il en faut 7",
      "Toujours verifier en remontant la chaine logique",
      "A utiliser en groupe pour eviter les biais individuels"
    ],
    keywords: ['5 pourquoi', 'pourquoi pourquoi', 'cause racine', 'root cause', 'analyse rapide', 'probleme ponctuel', 'creuser la cause', 'cause profonde incident', 'analyse rapide incident', 'remonter a la source', 'pourquoi ce probleme', 'comprendre l\'origine'],
    template: {
      file: 'templates/5-pourquoi-swm.pptx',
      label: 'Trame 5 Pourquoi (support SWM)',
      usage: [
        "Remplir l'entete : Animateur, Secteur, Date",
        "Ecrire le probleme de depart dans la premiere case",
        "Repondre \"Pourquoi ?\" et noter la reponse dans la case suivante, en descendant la chaine (jusqu'a 5 cases)",
        "Relier les cases entre elles pour bien visualiser l'enchainement logique",
        "Encadrer la case correspondant a la cause racine retenue"
      ],
      header: [
        { id: 'animateur', label: 'Animateur', auto: 'pilote' },
        { id: 'secteur', label: 'Secteur', auto: 'perimetre' },
        { id: 'date', label: 'Date', auto: 'date_debut' }
      ],
      fields: [
        { id: 'probleme', label: 'Probleme de depart', type: 'textarea', auto: 'probleme' },
        // Un niveau de "Pourquoi" peut avoir plusieurs causes : une par ligne,
        // comme les plusieurs cases prevues dans chaque colonne de la trame SWM.
        { id: 'pourquoi1', label: 'Pourquoi 1 (une cause par ligne)', type: 'textarea' },
        { id: 'pourquoi2', label: 'Pourquoi 2 (une cause par ligne)', type: 'textarea' },
        { id: 'pourquoi3', label: 'Pourquoi 3 (une cause par ligne)', type: 'textarea' },
        { id: 'pourquoi4', label: 'Pourquoi 4 (une cause par ligne)', type: 'textarea' },
        { id: 'pourquoi5', label: 'Pourquoi 5 - cause racine (une cause par ligne)', type: 'textarea' }
      ]
    }
  },
  {
    id: 'pareto',
    name: 'Diagramme de Pareto',
    icon: '📊',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Outil de priorisation base sur la loi des 80/20 : 20% des causes generent 80% des effets. Classe les causes/defauts par frequence ou impact decroissant.",
    whenToUse: [
      "Trop de causes ou de defauts a traiter, besoin de prioriser",
      "Donnees chiffrees disponibles (frequence, cout, temps d'arret...)",
      "Justifier objectivement le choix d'un chantier prioritaire"
    ],
    steps: [
      "Collecter les donnees quantifiees (nombre de defauts, temps perdu, cout...) par categorie",
      "Classer les categories par ordre decroissant d'impact",
      "Calculer les pourcentages cumules",
      "Tracer le diagramme (barres + courbe cumulee)",
      "Concentrer les actions sur les 20% de causes qui expliquent ~80% de l'effet"
    ],
    benefits: "Priorisation objective des actions, evite de disperser les efforts sur des causes mineures.",
    memo: [
      "Loi des 80/20 : peu de causes expliquent la majorite de l'effet",
      "Necessite des donnees chiffrees fiables",
      "Barres triees + courbe des pourcentages cumules",
      "Concentrer les efforts sur les 2-3 premieres barres",
      "A refaire apres actions pour verifier l'effet"
    ],
    keywords: ['pareto', '80/20', 'prioriser', 'quels defauts traiter en premier', 'classement des causes', 'top defauts', 'histogramme des defauts', 'analyse abc', 'top 3 causes', 'quel defaut prioritaire', 'classement decroissant', 'trop de causes a traiter', 'par ou commencer les actions']
  },
  {
    id: 'qqoqccp',
    name: 'QQOQCCP',
    icon: '📋',
    category: 'Diagnostic',
    phase: 'identification',
    summary: "Grille de questionnement (Quoi, Qui, Ou, Quand, Comment, Combien, Pourquoi) pour cadrer un probleme de maniere exhaustive avant de chercher des solutions.",
    whenToUse: [
      "Debut d'analyse d'un probleme mal defini ou flou",
      "Cadrage d'un chantier Kaizen (definir le perimetre)",
      "Besoin de rassembler des faits avant de brainstormer des causes"
    ],
    steps: [
      "Quoi : quel est le probleme exactement, quel defaut, quel ecart ?",
      "Qui : qui est concerne, qui a constate le probleme, qui intervient ?",
      "Ou : sur quelle ligne, quel poste, quelle zone se produit-il ?",
      "Quand : depuis quand, a quelle frequence, a quel moment du cycle ?",
      "Comment : comment se manifeste-t-il, comment est-il detecte ?",
      "Combien : quelle ampleur, quel cout, quelle frequence chiffree ?",
      "Pourquoi : pourquoi est-ce un probleme, pourquoi le traiter maintenant ?"
    ],
    benefits: "Cadrage rapide et complet, evite de partir sur de mauvaises hypotheses par manque de faits.",
    memo: [
      "Quoi / Qui / Ou / Quand / Comment / Combien / Pourquoi",
      "A utiliser AVANT l'Ishikawa ou les 5 Pourquoi",
      "Se baser sur des faits verifies, pas des impressions",
      "Sert aussi a cadrer le perimetre d'un chantier Kaizen"
    ],
    keywords: ['qqoqccp', 'cadrage', 'cadrer le probleme', 'definir le probleme', 'perimetre du chantier', 'grille de questionnement', 'questionnement structure', 'collecte de faits', 'definir le perimetre', 'probleme mal defini', 'probleme flou', 'clarifier le sujet'],
    template: {
      file: 'templates/qqoqccp-swm.pptx',
      label: 'Trame QQOQCCP (support SWM)',
      usage: [
        "Remplir l'entete : Animateur, Secteur, Date",
        "Repondre a chaque question autour du hub central (Quoi, Qui, Ou, Quand, Comment, Combien, Pourquoi)",
        "Commencer par \"Quoi\" (le probleme), les 6 autres questions viennent completer le cadrage",
        "Joindre une photo du terrain si utile (emplacement prevu sur la trame)",
        "Utiliser ce cadrage comme base avant de lancer un Ishikawa ou des 5 Pourquoi"
      ],
      header: [
        { id: 'animateur', label: 'Animateur', auto: 'pilote' },
        { id: 'secteur', label: 'Secteur', auto: 'perimetre' },
        { id: 'date', label: 'Date', auto: 'date_debut' }
      ],
      fields: [
        { id: 'quoi', label: 'Quoi', type: 'textarea' },
        { id: 'qui', label: 'Qui', type: 'textarea' },
        { id: 'ou', label: 'Ou', type: 'textarea' },
        { id: 'quand', label: 'Quand', type: 'textarea' },
        { id: 'comment', label: 'Comment', type: 'textarea' },
        { id: 'combien', label: 'Combien', type: 'textarea' },
        { id: 'pourquoi', label: 'Pourquoi', type: 'textarea' }
      ]
    }
  },
  {
    id: 'vsm',
    name: 'VSM (Value Stream Mapping)',
    icon: '🗺️',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Cartographie de la chaine de valeur : represente tous les flux physiques et d'information, du fournisseur au client, pour reperer les gaspillages.",
    whenToUse: [
      "Besoin d'une vision globale du flux (pas seulement un poste isole)",
      "Delais de livraison longs ou stocks intermediaires importants",
      "Preparation d'un projet Lean structurant sur plusieurs postes/services"
    ],
    steps: [
      "Choisir la famille de produits/flux a cartographier",
      "Cartographier l'etat actuel sur le terrain (Gemba) : flux physique, flux d'information, temps, stocks",
      "Calculer le lead time total et le temps a valeur ajoutee",
      "Identifier les gaspillages (attentes, stocks, transports inutiles, surproduction...)",
      "Dessiner l'etat futur cible et le plan d'actions pour y parvenir"
    ],
    benefits: "Vision d'ensemble partagee, met en evidence les gaspillages caches entre les postes, priorise les chantiers a fort impact.",
    memo: [
      "Cartographier flux physique ET flux d'information",
      "Toujours construire sur le terrain, pas depuis un bureau",
      "Calculer lead time total vs temps a valeur ajoutee",
      "Etat actuel -> etat futur -> plan d'actions",
      "Outil de niveau chaine de valeur, pas juste un poste"
    ],
    keywords: ['vsm', 'value stream mapping', 'cartographie des flux', 'chaine de valeur', 'lead time', 'flux d\'information', 'stocks intermediaires', 'delai de livraison client', 'flux logistique interne', 'macro processus', 'vision globale du flux', 'flux physique et information', 'temps a valeur ajoutee', 'cartographie processus']
  },
  {
    id: 'spaghetti',
    name: 'Diagramme Spaghetti',
    icon: '🍝',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Trace sur un plan les deplacements reels d'un operateur, d'une piece ou d'un document pour visualiser les trajets inutiles.",
    whenToUse: [
      "Suspicion de deplacements excessifs (operateur, chariot, document)",
      "Reimplantation d'un poste ou d'une ligne envisagee",
      "Temps de cycle eleve sans cause evidente au poste lui-meme"
    ],
    steps: [
      "Prendre le plan de la zone (poste, atelier, bureau)",
      "Suivre sur le terrain les deplacements reels et les tracer en continu sur le plan",
      "Repeter sur plusieurs cycles pour avoir une image representative",
      "Mesurer la distance totale parcourue et reperer les allers-retours inutiles",
      "Reimplanter pour reduire les distances et fluidifier le trajet"
    ],
    benefits: "Rend visibles des gaspillages de deplacement souvent invisibles au quotidien, argumente une reimplantation.",
    memo: [
      "1 plan + 1 crayon + observation terrain reelle",
      "Tracer chaque deplacement sans interpretation",
      "Repeter plusieurs cycles pour fiabiliser",
      "Objectif : reduire la distance totale parcourue",
      "Debouche souvent sur une reimplantation de poste"
    ],
    keywords: ['spaghetti', 'deplacements inutiles', 'trajet', 'reimplantation', 'distance parcourue', 'aller retour', 'plan d\'implantation', 'ergonomie deplacement', 'flux physique operateur', 'trop de marche', 'operateur qui marche trop', 'chariot qui fait des allers retours', 'circulation atelier']
  },
  {
    id: 'smed',
    name: 'SMED',
    icon: '⏱️',
    category: 'Organisation',
    phase: 'solution',
    summary: "Single Minute Exchange of Die : methode pour reduire drastiquement les temps de changement de serie/format/outillage.",
    whenToUse: [
      "Changements de serie ou de format longs",
      "Petites series frequentes penalisees par des reglages longs",
      "Besoin de gagner en flexibilite de production"
    ],
    steps: [
      "Filmer et chronometrer un changement de serie reel",
      "Separer les operations internes (machine arretee) des operations externes (realisables machine en marche)",
      "Convertir un maximum d'operations internes en externes (preparation en amont)",
      "Simplifier et standardiser les operations internes restantes (suppression de reglages, fixations rapides)",
      "Standardiser le nouveau mode operatoire et mesurer le gain de temps"
    ],
    benefits: "Reduction du temps d'arret machine, plus de flexibilite pour produire de petites series, gain de capacite sans investir.",
    memo: [
      "Interne = machine a l'arret / Externe = machine en marche",
      "1. Filmer   2. Separer interne/externe",
      "3. Convertir interne -> externe   4. Simplifier l'interne",
      "5. Standardiser + mesurer le nouveau temps",
      "Objectif symbolique : changement en moins de 10 minutes"
    ],
    keywords: ['smed', 'changement de serie', 'changement de format', 'changement de reference', 'reglage machine long', 'temps de changement outillage', 'arret machine pour reglage', 'temps d\'attente entre les series', 'temps d\'attente entre changements', 'changement d\'outillage', 'changement de moule', 'changement d\'outil presse', 'setup time', 'temps de setup', 'conversion de ligne', 'changement de fabrication', 'reglage trop long', 'temps de reglage', 'changement de production long']
  },
  {
    id: 'kanban',
    name: 'Kanban',
    icon: '🗂️',
    category: 'Organisation',
    phase: 'solution',
    summary: "Systeme visuel de pilotage des flux en tire (juste a temps), base sur des cartes ou signaux qui declenchent la production ou le reapprovisionnement.",
    whenToUse: [
      "Stocks intermediaires trop importants ou mal maitrises",
      "Besoin de piloter la production en flux tire plutot qu'en flux pousse",
      "Suivi visuel de taches ou d'un flux de travail (bureau, projet)"
    ],
    steps: [
      "Definir les etapes du flux et les stocks/en-cours a chaque etape",
      "Dimensionner le nombre de cartes/kanbans en fonction de la consommation reelle",
      "Mettre en place le support visuel (planche kanban, cartes physiques ou digitales)",
      "Former les equipes a la regle : on ne produit/deplace que sur signal kanban",
      "Ajuster regulierement le nombre de cartes selon la demande reelle"
    ],
    benefits: "Reduction des stocks, flux tire par la demande reelle, visualisation immediate des goulots.",
    memo: [
      "Flux tire : on produit sur signal, pas en prevision",
      "1 carte = 1 autorisation de produire/deplacer",
      "Dimensionner le nombre de cartes sur la consommation reelle",
      "Tableau visuel = A faire / En cours / Fait",
      "Ajuster regulierement selon la demande"
    ],
    keywords: ['kanban', 'flux tire', 'stock intermediaire', 'reapprovisionnement', 'tableau visuel', 'suivi des taches', 'planche kanban', 'etiquette kanban', 'supermarche production', 'dimensionnement de stock', 'gestion visuelle des priorites', 'cartes de production', 'trop de stock intermediaire', 'flux pousse a corriger']
  },
  {
    id: 'poka-yoke',
    name: 'Poka-Yoke',
    icon: '🛡️',
    category: 'Qualite',
    phase: 'solution',
    summary: "Systeme anti-erreur qui rend physiquement impossible ou immediatement detectable une erreur humaine, sans dependre de la vigilance de l'operateur.",
    whenToUse: [
      "Erreurs recurrentes liees a l'inattention ou a l'oubli",
      "Defaut qualite du a un montage ou un assemblage incorrect",
      "Le standard seul (procedure ecrite) ne suffit pas a eviter l'erreur"
    ],
    steps: [
      "Identifier precisement l'erreur humaine recurrente et son contexte",
      "Choisir le type de detrompeur : par contact (forme), par comptage, ou par sequence",
      "Privilegier une solution qui empeche physiquement l'erreur (prevention) plutot qu'une simple alerte (detection)",
      "Concevoir et tester le dispositif au poste avec les operateurs",
      "Verifier que l'erreur ne peut plus se produire, meme volontairement"
    ],
    benefits: "Elimine la cause d'erreur a la source, ne repose plus sur la vigilance humaine, tres bon retour sur investissement.",
    memo: [
      "Objectif : rendre l'erreur physiquement impossible",
      "3 types : detrompeur de forme, comptage, sequence obligatoire",
      "Prevention > detection > alerte simple",
      "Concevoir avec les operateurs qui vivent le probleme",
      "Tester en conditions reelles avant generalisation"
    ],
    keywords: ['poka-yoke', 'anti erreur', 'detrompeur', 'erreur humaine', 'oubli piece', 'montage incorrect', 'erreur de montage', 'securite erreur', 'erreur d\'assemblage', 'dispositif anti erreur', 'erreur recurrente montage', 'detection automatique erreur', 'piece oubliee', 'mauvais sens de montage', 'inversion de piece', 'assemblage a l\'envers', 'operateur se trompe souvent', 'oublient une piece', 'oublie une piece', 'oublient souvent', 'piece manquante', 'manque une piece', 'oubli recurrent']
  },
  {
    id: 'standard-work',
    name: 'Standard Work',
    icon: '📐',
    category: 'Organisation',
    phase: 'standardisation',
    summary: "Description precise et partagee de la meilleure facon connue a un instant T de realiser une operation, servant de reference et de base d'amelioration.",
    whenToUse: [
      "Variabilite de performance ou de qualite selon l'operateur",
      "Difficulte a former rapidement un nouvel arrivant",
      "Apres un chantier Kaizen, pour ancrer durablement le gain obtenu"
    ],
    steps: [
      "Observer et chronometrer la meilleure pratique actuelle sur le terrain",
      "Decomposer l'operation en etapes cles avec temps, points cles et points de securite/qualite",
      "Formaliser un document visuel simple (fiche standard, mode operatoire illustre)",
      "Former tous les operateurs concernes au meme standard",
      "Faire vivre le standard : toute amelioration devient le nouveau standard"
    ],
    benefits: "Reduit la variabilite, facilite la formation, cree une base stable a partir de laquelle ameliorer encore (pas de Kaizen durable sans standard).",
    memo: [
      "Le standard = la meilleure methode connue AUJOURD'HUI, pas figee",
      "Doit etre visuel, simple, affiche au poste",
      "Contient : sequence, temps, points cles qualite/securite",
      "Tout le monde applique le meme standard",
      "Toute amelioration validee devient le nouveau standard"
    ],
    keywords: ['standard work', 'mode operatoire', 'procedure standard', 'variabilite operateur', 'formation nouvel arrivant', 'meilleure pratique', 'instruction de travail', 'fiche de poste', 'ecart de methode entre operateurs', 'chaque operateur fait different', 'pas de procedure ecrite', 'methode de travail non definie', 'formation nouvelle recrue']
  },
  {
    id: 'tpm',
    name: 'TPM (Maintenance Productive Totale)',
    icon: '🔧',
    category: 'Qualite',
    phase: 'solution',
    summary: "Demarche visant a maximiser la disponibilite des equipements en impliquant les operateurs dans la maintenance de premier niveau (auto-maintenance).",
    whenToUse: [
      "Pannes frequentes ou imprevues sur un equipement",
      "Taux de rendement synthetique (TRS/OEE) insuffisant",
      "Maintenance uniquement curative, jamais preventive"
    ],
    steps: [
      "Mesurer le TRS et identifier les 6 grandes pertes (pannes, changements, micro-arrets, ralentissements, defauts, pertes au demarrage)",
      "Nettoyer/inspecter l'equipement en profondeur pour reveler les anomalies (fuites, jeux, usures)",
      "Traiter les causes des degradations accelerees et rendre les zones difficiles d'acces plus accessibles",
      "Definir des standards d'auto-maintenance simples confies aux operateurs (controles visuels, graissage, resserrage)",
      "Faire monter en competence les operateurs et suivre le TRS dans la duree"
    ],
    benefits: "Ameliore la disponibilite machine, responsabilise les operateurs, reduit les pannes couteuses en production.",
    memo: [
      "TRS = Disponibilite x Performance x Qualite",
      "6 grandes pertes a traquer",
      "Nettoyer = Inspecter (reveler les anomalies)",
      "Auto-maintenance : petits gestes confies aux operateurs",
      "Objectif : passer du curatif au preventif"
    ],
    keywords: ['tpm', 'maintenance', 'panne', 'trs', 'oeed', 'oee', 'arret machine', 'disponibilite machine', 'auto maintenance', 'maintenance preventive', 'maintenance curative', 'arret non planifie', 'graissage', 'resserrage', 'usure prematuree', 'fiabilite equipement', 'plan de maintenance', 'casse machine', 'panne imprevue', 'vibration', 'surchauffe', 'fuite hydraulique', 'fuite pneumatique', 'fuite', 'roulement use', 'courroie cassee', 'capteur defectueux', 'equipement fatigue', 'equipement vieillissant']
  },
  {
    id: 'andon',
    name: 'Andon',
    icon: '🚨',
    category: 'Qualite',
    phase: 'solution',
    summary: "Systeme d'alerte visuel et/ou sonore permettant a tout operateur de signaler immediatement un probleme et de declencher une reaction rapide.",
    whenToUse: [
      "Anomalies detectees mais signalees trop tard ou pas du tout",
      "Besoin de reactivite immediate sur une ligne de production",
      "Volonte de donner a l'operateur le pouvoir d'arreter la ligne en cas de defaut (Jidoka)"
    ],
    steps: [
      "Definir les criteres precis de declenchement de l'alerte (defaut, manque de piece, panne...)",
      "Choisir le support (cordon, bouton, voyant lumineux, tableau andon)",
      "Definir le circuit de reaction : qui intervient, en combien de temps",
      "Former les operateurs a declencher l'alerte sans crainte de consequence negative",
      "Suivre les declenchements pour alimenter les chantiers d'amelioration (Pareto des causes d'alerte)"
    ],
    benefits: "Reaction immediate aux anomalies, remonte l'information terrain en temps reel, renforce la culture qualite.",
    memo: [
      "Alerte immediate = probleme visible tout de suite",
      "Definir clairement quand declencher",
      "Circuit de reaction rapide et connu de tous",
      "L'operateur doit se sentir en confiance pour l'utiliser",
      "Les donnees andon nourrissent les chantiers Kaizen (Pareto)"
    ],
    keywords: ['andon', 'alerte visuelle', 'signal lumineux', 'arreter la ligne', 'signaler un probleme', 'reactivite', 'cordon d\'arret', 'ligne arretee', 'signalement immediat', 'tableau de bord visuel temps reel', 'bouton d\'alerte', 'voyant lumineux poste', 'probleme signale trop tard']
  },
  {
    id: 'jidoka',
    name: 'Jidoka',
    icon: '🤖',
    category: 'Qualite',
    phase: 'solution',
    summary: "Principe qui consiste a donner a la machine ou a l'operateur la capacite de detecter une anomalie et d'arreter automatiquement le processus pour ne jamais transmettre un defaut en aval.",
    whenToUse: [
      "Des defauts sont transmis au poste suivant ou jusqu'au client",
      "Un equipement continue de tourner malgre une anomalie detectable",
      "Volonte de construire la qualite au poste plutot que de la controler en fin de ligne"
    ],
    steps: [
      "Identifier les points ou un defaut peut etre genere et doit etre detecte immediatement",
      "Equiper le poste d'un dispositif de detection (capteur, controle visuel, poka-yoke)",
      "Programmer/organiser l'arret automatique ou le signal andon des detection d'anomalie",
      "Definir la reaction immediate : qui intervient, comment on isole la piece douteuse",
      "Analyser chaque arret pour traiter la cause racine et ne pas la revoir (5 Pourquoi)"
    ],
    benefits: "Aucun defaut ne part vers le client ou le poste suivant, la qualite est construite au poste et non controlee apres coup.",
    memo: [
      "Jidoka = automatisation avec une touche humaine",
      "Detecter l'anomalie -> Arreter -> Alerter -> Corriger",
      "Ne jamais laisser passer un defaut en aval",
      "Se combine naturellement avec Andon et Poka-Yoke",
      "Chaque arret doit etre analyse (5 Pourquoi)"
    ],
    keywords: ['jidoka', 'arret automatique', 'defaut transmis', 'controle qualite poste', 'detection anomalie automatique', 'qualite a la source', 'controle integre au poste', 'ne pas transmettre le defaut', 'machine continue malgre le defaut', 'defaut envoye au poste suivant']
  },
  {
    id: 'heijunka',
    name: 'Heijunka (Lissage)',
    icon: '📈',
    category: 'Organisation',
    phase: 'solution',
    summary: "Lissage de la production en volume et en variete pour eviter les a-coups (Mura) et produire regulierement selon la demande moyenne plutot que par gros lots.",
    whenToUse: [
      "Production tres irreguliere avec pics et creux importants",
      "Grosses series qui generent des stocks et des urgences alternees",
      "Difficulte a repondre a une demande variee avec les memes ressources"
    ],
    steps: [
      "Analyser la demande client sur une periode representative (volume et mix produits)",
      "Calculer le volume et le mix de production lisses (petites quantites frequentes de chaque reference)",
      "Concevoir une boite de lissage (heijunka box) planifiant les sequences de production",
      "Reduire les tailles de lot (souvent en s'appuyant sur un SMED efficace)",
      "Suivre l'ecart entre plan lisse et realise, ajuster progressivement"
    ],
    benefits: "Reduit les a-coups de charge, stabilise les besoins en ressources et en composants, facilite le flux tire.",
    memo: [
      "Objectif : lisser volume ET variete, pas juste le volume",
      "Petites series frequentes plutot que gros lots espaces",
      "S'appuie souvent sur un SMED performant",
      "Heijunka box = outil de sequencement visuel",
      "Combat le Mura (l'irregularite), source de Muri et Muda"
    ],
    keywords: ['heijunka', 'lissage', 'lissage production', 'a coups de charge', 'gros lots', 'planification irreguliere', 'pics et creux de charge', 'regularite de production', 'production tres irreguliere', 'trop de series longues', 'urgences alternees']
  },
  {
    id: 'takt-time',
    name: 'Takt Time',
    icon: '⏲️',
    category: 'Organisation',
    phase: 'analyse',
    summary: "Rythme de production necessaire pour repondre exactement a la demande client, calcule en divisant le temps d'ouverture disponible par la demande client sur la periode.",
    whenToUse: [
      "Besoin de dimensionner une ligne ou un poste par rapport a la demande reelle",
      "Cadence de production non alignee avec la demande client (trop vite ou trop lentement)",
      "Equilibrage de ligne ou repartition des operations entre postes"
    ],
    steps: [
      "Determiner le temps d'ouverture disponible sur la periode (ex : par jour, hors pauses)",
      "Determiner la demande client sur cette meme periode",
      "Calculer le Takt Time = Temps d'ouverture disponible / Demande client",
      "Comparer le temps de cycle reel de chaque poste au Takt Time",
      "Equilibrer les operations entre postes pour se rapprocher du Takt Time"
    ],
    benefits: "Aligne precisement la capacite de production sur la demande reelle, evite surproduction et sous-capacite.",
    memo: [
      "Takt Time = Temps d'ouverture disponible / Demande client",
      "C'est un rythme cible, pas une mesure du reel",
      "Comparer chaque temps de cycle poste au Takt Time",
      "Sert de base a l'equilibrage de ligne",
      "A recalculer des que la demande change"
    ],
    keywords: ['takt time', 'cadence', 'rythme de production', 'equilibrage de ligne', 'temps de cycle vs demande', 'dimensionnement effectif', 'cadence non alignee avec la demande', 'ligne trop lente', 'ligne trop rapide', 'combien d\'operateurs par poste']
  },
  {
    id: 'a3',
    name: 'Rapport A3',
    icon: '📄',
    category: 'Pilotage',
    phase: 'standardisation',
    summary: "Methode de resolution de probleme et de communication tenant sur une seule feuille A3, structurant la demarche PDCA de facon visuelle et synthetique.",
    whenToUse: [
      "Besoin de presenter un chantier Kaizen de facon synthetique a la hierarchie",
      "Formaliser durablement un probleme resolu pour capitaliser",
      "Piloter un projet d'amelioration avec une trame partagee par tous"
    ],
    steps: [
      "Contexte et probleme : situation actuelle, enjeu, pourquoi agir maintenant",
      "Objectif cible : etat futur souhaite, indicateur et valeur cible",
      "Analyse des causes : Ishikawa / 5 Pourquoi resumes visuellement",
      "Plan d'actions : actions, responsables, delais",
      "Suivi des resultats : indicateur avant/apres, ecart a l'objectif",
      "Standardisation : ce qui est perennise et les points de vigilance restants"
    ],
    benefits: "Communication visuelle et synthetique, force a etre factuel et concis, excellent support de management visuel.",
    memo: [
      "1 seule feuille A3, pas plus",
      "Suit la logique PDCA de haut en bas ou gauche a droite",
      "Contexte -> Objectif -> Causes -> Actions -> Resultats -> Standard",
      "Toujours base sur des donnees factuelles et chiffrees",
      "Sert de support de communication ET de pilotage"
    ],
    keywords: ['a3', 'rapport a3', 'synthese chantier', 'presentation projet', 'reporting kaizen', 'fiche projet amelioration', 'communication visuelle projet', 'presenter a la direction', 'formaliser le chantier', 'capitaliser sur un projet']
  },
  {
    id: 'gemba-walk',
    name: 'Gemba Walk',
    icon: '🚶',
    category: 'Pilotage',
    phase: 'identification',
    summary: "Pratique consistant a se rendre sur le terrain (le Gemba, \"lieu reel\") pour observer directement le travail, dialoguer avec les operateurs et constater les faits.",
    whenToUse: [
      "Decision a prendre sur un probleme terrain sans etre alle constater soi-meme",
      "Management qui perd le contact avec la realite operationnelle",
      "Verification que les standards definis sont reellement appliques"
    ],
    steps: [
      "Preparer l'objet de l'observation (un poste, un flux, un standard a verifier)",
      "Se rendre physiquement sur le terrain, observer sans juger ni interrompre",
      "Poser des questions ouvertes aux operateurs, ecouter leurs difficultes reelles",
      "Comparer ce qui est observe au standard attendu",
      "Remercier, restituer les constats et co-construire les actions avec l'equipe"
    ],
    benefits: "Decisions basees sur des faits reels et non des suppositions, renforce la confiance entre management et terrain.",
    memo: [
      "Gemba = le lieu ou la valeur est reellement creee",
      "Aller voir avant de juger ou de decider",
      "Observer, questionner, ecouter, respecter",
      "Comparer l'observe au standard defini",
      "Toujours en repartir avec des faits, pas des impressions"
    ],
    keywords: ['gemba', 'gemba walk', 'aller sur le terrain', 'observation terrain', 'verifier le standard', 'management visuel terrain', 'tournee terrain', 'verifier sur place', 'aller voir la realite', 'perte de contact avec le terrain', 'management deconnecte du terrain']
  },
  {
    id: 'kata-kaizen',
    name: 'Kata Kaizen',
    icon: '🥋',
    category: 'Pilotage',
    phase: 'plan-action',
    summary: "Routine quotidienne d'amelioration continue structuree : viser un etat cible, comprendre l'etat actuel, avancer par petits pas experimentaux (PDCA a haute frequence).",
    whenToUse: [
      "Volonte d'ancrer une culture d'amelioration continue durable, pas seulement des chantiers ponctuels",
      "Equipe qui souhaite progresser pas a pas vers un objectif ambitieux",
      "Encadrement qui veut developper l'autonomie des equipes dans l'amelioration"
    ],
    steps: [
      "Clarifier la direction/le defi a moyen terme (vision)",
      "Comprendre precisement l'etat actuel (donnees, observation terrain)",
      "Definir le prochain etat cible, atteignable a court terme (quelques jours/semaines)",
      "Experimenter par petits pas (PDCA rapides) pour avancer vers cet etat cible",
      "Faire un point tres regulier (quotidien) sur les obstacles rencontres et les enseignements"
    ],
    benefits: "Cree une habitude durable d'amelioration continue, developpe l'autonomie et les reflexes d'analyse des equipes.",
    memo: [
      "Vision -> Etat actuel -> Etat cible proche -> Experimentation",
      "Petits pas frequents plutot qu'un grand saut",
      "Point quotidien : qu'avons-nous appris hier ?",
      "Developpe le reflexe d'amelioration continue de l'equipe",
      "Complementaire des chantiers Kaizen ponctuels"
    ],
    keywords: ['kata', 'kata kaizen', 'routine amelioration continue', 'culture kaizen', 'amelioration quotidienne', 'petits pas', 'coaching amelioration', 'ancrer une culture d\'amelioration', 'progresser pas a pas', 'habitude d\'amelioration']
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming & Vote pondere',
    icon: '💡',
    category: 'Pilotage',
    phase: 'solution',
    summary: "Technique de production collective d'idees suivie d'une methode de priorisation par vote pondere entre les participants d'un chantier Kaizen.",
    whenToUse: [
      "Recherche de causes ou de solutions en groupe pluridisciplinaire",
      "Besoin de faire emerger un consensus sur les priorites du chantier",
      "Lancement d'un chantier Kaizen (phase de creativite initiale)"
    ],
    steps: [
      "Rappeler la regle : aucune idee n'est jugee pendant la phase de generation",
      "Faire produire un maximum d'idees individuellement puis les partager (brainwriting ou tour de table)",
      "Regrouper les idees similaires et clarifier chacune avec le groupe",
      "Faire voter chaque participant avec un nombre de points limite a repartir",
      "Retenir les idees les mieux notees pour le plan d'actions"
    ],
    benefits: "Mobilise l'intelligence collective, favorise l'adhesion de l'equipe aux solutions choisies.",
    memo: [
      "Phase 1 : generer sans juger",
      "Phase 2 : regrouper et clarifier",
      "Phase 3 : voter avec un nombre de points limite par personne",
      "Le vote cree l'adhesion collective aux priorites",
      "A utiliser en debut de chantier ou pour choisir entre solutions"
    ],
    keywords: ['brainstorming', 'vote pondere', 'idees', 'creativite groupe', 'choisir une solution', 'consensus equipe', 'atelier collaboratif', 'reunion d\'idees', 'faire emerger des solutions', 'choisir entre plusieurs solutions']
  },
  {
    id: 'matrice-decision',
    name: 'Matrice de decision',
    icon: '⚖️',
    category: 'Pilotage',
    phase: 'solution',
    summary: "Outil de choix multicritere qui compare plusieurs solutions face a des criteres ponderes, pour objectiver une decision plutot que trancher a l'instinct.",
    whenToUse: [
      "Plusieurs solutions candidates apres un brainstorming",
      "Desaccord d'equipe sur la solution a retenir",
      "Choix d'investissement ou d'organisation a argumenter aupres de la hierarchie"
    ],
    steps: [
      "Lister les solutions candidates (en colonnes)",
      "Definir les criteres de choix (cout, delai, impact, faisabilite, risque...) et leur poids relatif",
      "Noter chaque solution sur chaque critere (ex : de 1 a 5)",
      "Multiplier chaque note par le poids du critere et sommer par solution",
      "Retenir la solution au meilleur score, en verifiant la coherence avec le bon sens terrain"
    ],
    benefits: "Decision objective et argumentee, facilite l'adhesion de l'equipe, evite de choisir la solution la plus 'bruyante' plutot que la plus pertinente.",
    memo: [
      "Solutions en colonnes, criteres en lignes",
      "Chaque critere a un poids (son importance relative)",
      "Note x poids = score ; on additionne par solution",
      "La meilleure solution n'est pas toujours celle preferee au depart",
      "A utiliser juste apres un brainstorming de solutions"
    ],
    keywords: ['matrice de decision', 'matrice de choix', 'choisir entre plusieurs solutions', 'comparer des solutions', 'decision multicritere', 'pugh matrix', 'quelle solution choisir', 'aide a la decision', 'criteres ponderes']
  },
  {
    id: 'matrice-gain-effort',
    name: 'Matrice Gain / Effort',
    icon: '🎯',
    category: 'Pilotage',
    phase: 'solution',
    summary: "Matrice 2x2 qui positionne chaque solution selon son gain attendu et l'effort necessaire pour la mettre en oeuvre, afin de reperer en un coup d'oeil les 'quick wins' a lancer en priorite.",
    whenToUse: [
      "Plusieurs solutions ou actions candidates apres un brainstorming",
      "Besoin de prioriser rapidement sans grille de criteres lourde",
      "Volonte de demarrer par des victoires rapides pour embarquer l'equipe"
    ],
    steps: [
      "Lister toutes les solutions ou actions candidates",
      "Pour chaque solution, estimer le Gain attendu (faible a fort) et l'Effort necessaire (faible a fort)",
      "Placer chaque solution dans le quadrant correspondant de la matrice",
      "Prioriser en premier les solutions a Gain fort / Effort faible (quick wins)",
      "Planifier ensuite les Gain fort / Effort fort, et ecarter ou reporter les Gain faible / Effort fort"
    ],
    benefits: "Priorisation visuelle et rapide, sans calcul complexe, ideale pour lancer une dynamique avec des resultats visibles tot dans le chantier.",
    memo: [
      "2 axes : Gain (attendu) et Effort (necessaire)",
      "Quadrant ideal : Gain fort / Effort faible = quick win",
      "Eviter en priorite : Gain faible / Effort fort",
      "Plus rapide a remplir qu'une matrice de decision ponderee",
      "A utiliser juste apres un brainstorming de solutions"
    ],
    keywords: ['matrice gain effort', 'gain effort', 'quick win', 'victoire rapide', 'prioriser les actions', 'matrice impact effort', 'matrice 2x2', 'priorisation solutions', 'quelle action lancer en premier'],
    template: {
      file: 'templates/matrice-gain-effort-swm.pptx',
      label: 'Trame Matrice Gain/Effort (support SWM)',
      usage: [
        "Remplir l'entete : Chantier, Date",
        "Ecrire chaque solution candidate sur une etiquette ou un post-it",
        "Positionner chaque etiquette dans la matrice selon son Gain (bas/haut) et son Effort (gauche/droite)",
        "Repartir en groupe pour eviter qu'une seule personne tranche seule",
        "Lancer en priorite les solutions du quadrant Gain fort / Effort faible"
      ],
      header: [
        { id: 'chantier', label: 'Chantier', auto: 'titre' },
        { id: 'date', label: 'Date', auto: 'date_debut' }
      ],
      fields: [
        {
          id: 'solutions', type: 'repeatable', label: 'Solutions a positionner',
          columns: [
            { id: 'solution', label: 'Solution', type: 'text' },
            { id: 'gain', label: 'Gain', type: 'select', options: ['Faible', 'Fort'] },
            { id: 'effort', label: 'Effort', type: 'select', options: ['Faible', 'Fort'] }
          ]
        }
      ]
    }
  },
  {
    id: 'adkar',
    name: 'ADKAR',
    icon: '🧭',
    category: 'Gestion de projet',
    phase: 'standardisation',
    summary: "Modele de conduite du changement en 5 etapes individuelles (Awareness, Desire, Knowledge, Ability, Reinforcement) pour que chacun adopte durablement le changement issu d'un chantier Kaizen.",
    whenToUse: [
      "Un chantier Kaizen change durablement une facon de travailler",
      "Resistance au changement observee sur le terrain",
      "Standard non applique malgre la formation, retour aux anciennes habitudes"
    ],
    steps: [
      "Awareness (Conscience) : expliquer pourquoi le changement est necessaire et quel probleme il resout",
      "Desire (Desir) : creer l'envie de participer, impliquer les personnes concernees des le diagnostic",
      "Knowledge (Connaissance) : former concretement au nouveau standard ou a la nouvelle methode",
      "Ability (Capacite) : accompagner sur le terrain jusqu'a la maitrise reelle, pas seulement la theorie",
      "Reinforcement (Renforcement) : suivre, feliciter et corriger les ecarts pour ancrer durablement le changement"
    ],
    benefits: "Evite l'echec des chantiers Kaizen par manque d'adhesion humaine ; complete les outils techniques par la dimension humaine du changement.",
    memo: [
      "A - Awareness : pourquoi changer",
      "D - Desire : l'envie de changer",
      "K - Knowledge : savoir comment",
      "A - Ability : savoir faire en vrai, pas juste en theorie",
      "R - Reinforcement : ancrer dans la duree",
      "Un chantier technique sans ADKAR retombe souvent dans les anciennes habitudes"
    ],
    keywords: ['adkar', 'conduite du changement', 'resistance au changement', 'gestion du changement', 'adoption du changement', 'perenniser le changement', 'standard pas applique', 'retour aux anciennes habitudes', 'equipe refuse le changement']
  },
  {
    id: 'dmaic',
    name: 'DMAIC',
    icon: '🎯',
    category: 'Pilotage',
    phase: 'analyse',
    summary: "Demarche structuree Six Sigma en 5 phases (Define, Measure, Analyze, Improve, Control) pour resoudre un probleme complexe avec rigueur statistique, complementaire du PDCA.",
    whenToUse: [
      "Probleme complexe avec plusieurs causes potentielles et des donnees disponibles",
      "Variabilite de process a reduire durablement",
      "Projet d'amelioration structurant necessitant une preuve statistique du gain"
    ],
    steps: [
      "Define : definir le probleme, le perimetre, l'objectif chiffre et les parties prenantes",
      "Measure : mesurer la situation actuelle de facon fiable (donnees, capabilite du process)",
      "Analyze : analyser les donnees pour identifier les causes racines statistiquement significatives",
      "Improve : tester puis deployer les solutions correspondant aux causes averees",
      "Control : mettre en place un controle durable (carte de controle, standard) pour maintenir le gain"
    ],
    benefits: "Rigueur statistique, evite d'agir sur de fausses causes, structure les projets d'amelioration complexes et durables.",
    memo: [
      "Define -> Measure -> Analyze -> Improve -> Control",
      "Toujours mesurer avant d'agir (Measure avant Improve)",
      "S'appuie sur des donnees, pas des impressions",
      "Control est indispensable pour ne pas retomber dans l'ancien etat",
      "Plus lourd que le PDCA : reserve aux problemes complexes"
    ],
    keywords: ['dmaic', 'six sigma', 'define measure analyze improve control', 'demarche statistique', 'reduire la variabilite', 'projet complexe amelioration', 'capabilite process']
  },
  {
    id: 'sipoc',
    name: 'SIPOC',
    icon: '🔗',
    category: 'Diagnostic',
    phase: 'identification',
    summary: "Cartographie synthetique d'un processus en 5 colonnes (Suppliers, Inputs, Process, Outputs, Customers) pour en cadrer le perimetre avant une analyse plus fine (VSM, DMAIC...).",
    whenToUse: [
      "Besoin de cadrer un processus avant de le cartographier en detail",
      "Equipe qui ne partage pas la meme vision du debut et de la fin du processus",
      "Demarrage d'un projet DMAIC ou VSM"
    ],
    steps: [
      "Nommer le processus et definir ses bornes precises (debut et fin)",
      "Lister les Suppliers : qui fournit les entrees du processus",
      "Lister les Inputs : quelles entrees (matieres, informations, ordres)",
      "Decrire le Process en 4 a 6 grandes etapes macro (pas le detail)",
      "Lister les Outputs : les sorties produites",
      "Lister les Customers : qui recoit ou utilise ces sorties"
    ],
    benefits: "Cadrage rapide et partage du perimetre, base commune avant d'aller plus loin (VSM, DMAIC, Ishikawa).",
    memo: [
      "Suppliers -> Inputs -> Process -> Outputs -> Customers",
      "Niveau macro : 4 a 6 etapes maximum pour le Process",
      "A faire en groupe pour aligner les points de vue",
      "Etape prealable classique a un VSM ou un DMAIC"
    ],
    keywords: ['sipoc', 'cartographie processus macro', 'perimetre du processus', 'fournisseurs entrees sorties clients', 'cadrer un processus'],
    template: {
      file: 'templates/sipoc-swm.pptx',
      label: 'Trame SIPOC (support SWM)',
      usage: [
        "Remplir l'entete : Processus analyse, Responsable, Date, Revision",
        "Completer les 5 colonnes dans l'ordre : Fournisseurs, Entrees, Processus, Sorties, Clients",
        "S'aider des questions guides indiquees sous chaque colonne",
        "Renseigner aussi la ligne Voix du Client et les indicateurs (Exigences, Pilotage, Resultats) en bas de trame",
        "Faire remplir en groupe pour aligner tout le monde sur le meme perimetre avant d'aller plus loin (VSM, DMAIC)"
      ],
      header: [
        { id: 'processus', label: 'Processus analyse', auto: 'titre' },
        { id: 'responsable', label: 'Responsable', auto: 'pilote' },
        { id: 'date', label: 'Date', auto: 'date_debut' },
        { id: 'revision', label: 'Revision', auto: null }
      ],
      fields: [
        { id: 'suppliers', label: 'Suppliers (fournisseurs)', type: 'textarea' },
        { id: 'inputs', label: 'Inputs (entrees)', type: 'textarea' },
        { id: 'process', label: 'Process (etapes macro)', type: 'textarea' },
        { id: 'outputs', label: 'Outputs (sorties)', type: 'textarea' },
        { id: 'customers', label: 'Customers (clients)', type: 'textarea' },
        { id: 'voix_client', label: 'Voix du client', type: 'textarea' },
        { id: 'ind_exigences', label: 'Indicateur Exigences', type: 'text' },
        { id: 'ind_pilotage', label: 'Indicateur Pilotage', type: 'text' },
        { id: 'ind_resultats', label: 'Indicateur Resultats', type: 'text' }
      ]
    }
  },
  {
    id: 'raci',
    name: 'Matrice RACI',
    icon: '🗒️',
    category: 'Gestion de projet',
    phase: 'plan-action',
    summary: "Matrice qui clarifie les roles de chacun sur un projet ou un chantier : Responsable (fait), Accountable (rend compte), Consulte, Informe.",
    whenToUse: [
      "Chantier ou projet avec plusieurs intervenants et des roles flous",
      "Taches qui trainent car personne ne se sent responsable",
      "Besoin de clarifier qui decide vs qui execute"
    ],
    steps: [
      "Lister les grandes activites ou decisions du chantier en lignes",
      "Lister les personnes ou roles impliques en colonnes",
      "Attribuer un seul R (Responsable de la realisation) par activite",
      "Attribuer un seul A (Accountable, rend des comptes sur le resultat) par activite",
      "Identifier les C (Consulte avant decision) et les I (Informe apres coup)"
    ],
    benefits: "Clarifie qui fait quoi, evite les taches orphelines ou les doublons, accelere la prise de decision.",
    memo: [
      "R = Responsable (fait) / A = Accountable (rend compte)",
      "C = Consulte / I = Informe",
      "Un seul A par activite : jamais zero, jamais plusieurs",
      "Utile des le lancement d'un chantier avec plusieurs services",
      "A revoir si le chantier change de perimetre"
    ],
    keywords: ['raci', 'matrice raci', 'roles et responsabilites', 'qui fait quoi', 'personne responsable', 'taches orphelines', 'clarifier les roles projet']
  },
  {
    id: 'gantt',
    name: 'Diagramme de Gantt',
    icon: '📅',
    category: 'Gestion de projet',
    phase: 'plan-action',
    summary: "Planning visuel qui represente les taches d'un chantier dans le temps, avec leurs dependances, pour piloter les delais d'un projet d'amelioration.",
    whenToUse: [
      "Chantier avec plusieurs actions dependantes les unes des autres",
      "Besoin de visualiser les delais et les jalons",
      "Plusieurs personnes a coordonner dans le temps"
    ],
    steps: [
      "Lister toutes les actions du plan d'action avec leur duree estimee",
      "Identifier les dependances : quelle action doit finir avant qu'une autre commence",
      "Placer les actions sur une frise chronologique (barres horizontales)",
      "Identifier le chemin critique : la suite d'actions qui determine la duree totale",
      "Suivre l'avancement reel vs planifie et ajuster"
    ],
    benefits: "Vision claire des delais et des dependances, identifie le chemin critique a surveiller en priorite.",
    memo: [
      "Barres horizontales = duree de chaque action dans le temps",
      "Fleches = dependances entre actions",
      "Chemin critique = suite d'actions qui ne doit pas prendre de retard",
      "Complementaire du plan d'action simple quand les dependances sont nombreuses"
    ],
    keywords: ['gantt', 'diagramme de gantt', 'planning projet', 'chemin critique', 'jalons', 'dependances entre taches', 'planifier le chantier dans le temps']
  },
  {
    id: 'amdec',
    name: 'AMDEC (FMEA)',
    icon: '⚠️',
    category: 'Qualite',
    phase: 'analyse',
    summary: "Analyse des Modes de Defaillance, de leurs Effets et de leur Criticite : methode preventive qui identifie et hierarchise les risques d'un produit ou d'un processus avant qu'ils ne surviennent.",
    whenToUse: [
      "Conception d'un nouveau produit, processus ou equipement",
      "Modification importante d'un processus existant",
      "Besoin de prioriser les actions preventives selon la criticite reelle du risque"
    ],
    steps: [
      "Lister les fonctions ou etapes du processus/produit a analyser",
      "Pour chaque etape, identifier les modes de defaillance possibles (comment ca peut echouer)",
      "Evaluer chaque mode selon 3 criteres : Gravite, Frequence (occurrence), Detection",
      "Calculer la Criticite = Gravite x Frequence x Detection (indice de priorite du risque)",
      "Definir des actions preventives sur les risques les plus critiques et recalculer la criticite apres action"
    ],
    benefits: "Anticipe les defaillances avant qu'elles ne se produisent, priorise objectivement les actions preventives, capitalise la connaissance du risque pour les projets futurs.",
    memo: [
      "Criticite = Gravite x Frequence x Detection",
      "AMDEC produit (conception) ou AMDEC processus (fabrication)",
      "Agir en priorite sur les criticites les plus elevees",
      "Recalculer la criticite apres chaque action pour verifier l'efficacite",
      "Document vivant, a mettre a jour a chaque evolution"
    ],
    keywords: ['amdec', 'fmea', 'analyse des modes de defaillance', 'criticite', 'analyse de risque produit', 'analyse de risque process', 'prevenir les defauts', 'gravite frequence detection']
  },
  {
    id: '7-gaspillages',
    name: 'Les 7 Gaspillages (Muda)',
    icon: '🗑️',
    category: 'Diagnostic',
    phase: 'identification',
    summary: "Grille de lecture qui classe tout gaspillage observe sur le terrain en 7 familles (Muda), pour reperer systematiquement ce qui ne cree pas de valeur pour le client.",
    whenToUse: [
      "Premiere observation d'un poste ou d'une ligne avant de choisir un outil Kaizen",
      "Formation d'une equipe a la culture Lean",
      "Besoin d'un langage commun pour designer les pertes observees"
    ],
    steps: [
      "Observer le poste ou le processus sur le terrain (Gemba)",
      "Reperer la Surproduction : produire plus ou avant la demande",
      "Reperer les Attentes : operateur ou machine qui attend",
      "Reperer les Transports et les Mouvements inutiles, les Stocks excessifs",
      "Reperer les Traitements inutiles (sur-qualite) et les Defauts/retouches",
      "Classer chaque gaspillage observe et le relier a l'outil Kaizen adapte pour le traiter"
    ],
    benefits: "Vocabulaire commun et systematique pour ne rien laisser passer, point de depart naturel de tout diagnostic Kaizen.",
    memo: [
      "Surproduction, Attente, Transport, Traitement inutile, Stock, Mouvement, Defauts",
      "A chercher en premier, avant de choisir un outil",
      "Chaque Muda oriente vers un outil : stock -> Kanban, attente -> SMED/TPM, defaut -> Poka-Yoke",
      "Outil d'observation, pas de resolution en soi"
    ],
    keywords: ['7 gaspillages', 'muda', 'gaspillage', 'surproduction', 'sur-stockage', 'mouvements inutiles', 'traitement inutile', 'sur qualite', 'types de gaspillage', 'chasse au gaspillage'],
    template: {
      file: 'templates/chasse-aux-mudas-swm.pptx',
      label: 'Trame Chasse aux Mudas (support SWM)',
      usage: [
        "Remplir l'entete : Date, Secteur/Zone, Equipe, Animateur",
        "Note : la trame SWM utilise la variante a 8 Mudas (ajoute la Non-utilisation des competences aux 7 classiques) — voir la legende sur la trame",
        "A chaque gaspillage repere sur le terrain, poser une pastille numerotee sur le plan de la zone",
        "Reporter ce numero dans le tableau : type de Muda, zone precise, description du probleme, impact (1 a 5), reference photo",
        "Prendre une photo si utile et noter sa reference dans le tableau",
        "Une fois le releve termine, prioriser par impact et relier chaque gaspillage a l'outil Kaizen adapte"
      ],
      header: [
        { id: 'date', label: 'Date', auto: 'date_debut' },
        { id: 'secteur', label: 'Secteur / Zone', auto: 'perimetre' },
        { id: 'equipe', label: 'Equipe', auto: 'equipe' },
        { id: 'animateur', label: 'Animateur', auto: 'pilote' }
      ],
      fields: [
        {
          id: 'gaspillages', type: 'repeatable', label: 'Gaspillages releves',
          columns: [
            { id: 'type', label: 'Type de Muda', type: 'select', options: ['Surproduction', 'Attentes', 'Transports', 'Sur-stocks', 'Deplacements', 'Sur-traitements', 'Defauts', 'Non-utilisation des competences'] },
            { id: 'zone', label: 'Zone / Localisation', type: 'text' },
            { id: 'probleme', label: 'Problematique observee', type: 'text' },
            { id: 'impact', label: 'Impact (1-5)', type: 'select', options: ['1', '2', '3', '4', '5'] }
          ]
        }
      ]
    }
  },
  {
    id: 'hoshin-kanri',
    name: 'Hoshin Kanri (Matrice X)',
    icon: '🧩',
    category: 'Pilotage',
    phase: 'identification',
    summary: "Methode de deploiement de la strategie qui relie les objectifs annuels de la direction aux chantiers Kaizen concrets menes sur le terrain, via une matrice de coherence (Matrice X).",
    whenToUse: [
      "Besoin de relier les chantiers Kaizen locaux a la strategie de l'entreprise",
      "Trop de chantiers disperses sans priorite claire",
      "Direction qui souhaite deployer 2-3 objectifs annuels jusqu'au terrain"
    ],
    steps: [
      "Definir 2 a 4 objectifs strategiques annuels au niveau direction",
      "Decliner ces objectifs en objectifs intermediaires par service ou atelier",
      "Identifier les chantiers Kaizen concrets qui contribuent a chaque objectif intermediaire",
      "Formaliser les liens dans la Matrice X (strategie / objectifs annuels / projets / indicateurs)",
      "Suivre regulierement (revue mensuelle) l'avancement des chantiers vs les objectifs"
    ],
    benefits: "Aligne les chantiers Kaizen du terrain avec la strategie globale, evite la dispersion, donne du sens aux equipes.",
    memo: [
      "Relie Strategie -> Objectifs annuels -> Chantiers -> Indicateurs",
      "La Matrice X visualise ces liens sur une seule page",
      "A revoir a frequence annuelle (strategie) et mensuelle (suivi chantiers)",
      "Evite les chantiers Kaizen sans lien avec les priorites de l'entreprise"
    ],
    keywords: ['hoshin kanri', 'matrice x', 'deploiement strategique', 'alignement strategie', 'objectifs annuels', 'priorites chantiers', 'trop de chantiers disperses']
  },
  {
    id: 'swot',
    name: 'Analyse SWOT (FFOM)',
    icon: '🧱',
    category: 'Pilotage',
    phase: 'identification',
    summary: "Grille qui croise Forces et Faiblesses internes avec Opportunites et Menaces externes, pour cadrer une reflexion strategique avant de lancer une demarche d'amelioration a grande echelle.",
    whenToUse: [
      "Lancement d'un programme Kaizen a l'echelle d'un site ou d'un service",
      "Besoin de prendre du recul avant de choisir les priorites d'amelioration",
      "Preparation d'une revue de direction ou d'un plan strategique"
    ],
    steps: [
      "Lister les Forces : atouts internes actuels (competences, equipements, reputation)",
      "Lister les Faiblesses : points internes a ameliorer",
      "Lister les Opportunites : elements externes favorables (marche, technologie, reglementation)",
      "Lister les Menaces : elements externes defavorables",
      "Croiser les 4 categories pour degager des priorites d'action (ex : utiliser une Force pour saisir une Opportunite)"
    ],
    benefits: "Vision d'ensemble avant l'action, evite de lancer des chantiers Kaizen deconnectes du contexte global.",
    memo: [
      "Interne : Forces / Faiblesses - Externe : Opportunites / Menaces",
      "Utile en amont, pas pour un probleme ponctuel precis",
      "Croiser les cases pour en tirer des priorites, pas juste lister",
      "A refaire periodiquement (le contexte evolue)"
    ],
    keywords: ['swot', 'ffom', 'forces faiblesses opportunites menaces', 'analyse strategique', 'diagnostic global', 'avant de lancer un programme kaizen']
  },
  {
    id: 'histogramme',
    name: 'Histogramme',
    icon: '📶',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Representation graphique de la distribution d'une donnee mesuree, pour visualiser la dispersion, la tendance centrale et detecter des anomalies de process.",
    whenToUse: [
      "Donnees chiffrees continues disponibles (dimensions, temps de cycle, poids...)",
      "Besoin de visualiser la variabilite d'un process, pas seulement sa moyenne",
      "Suspicion de process instable ou de melange de deux populations"
    ],
    steps: [
      "Collecter un echantillon suffisant de mesures (au moins 30 a 50 valeurs)",
      "Definir des classes (intervalles) couvrant l'etendue des valeurs",
      "Compter le nombre de valeurs dans chaque classe",
      "Tracer les barres : hauteur = frequence de chaque classe",
      "Analyser la forme (normale, asymetrique, bimodale) et la comparer aux limites specifiees"
    ],
    benefits: "Rend visible la variabilite reelle du process, detecte les melanges de populations ou les derives invisibles sur une simple moyenne.",
    memo: [
      "Barres = frequence de chaque classe de valeurs",
      "Regarder la forme : normale, decalee, deux pics (bimodale)",
      "Comparer la dispersion aux limites specifiees (tolerance)",
      "Necessite un echantillon suffisant pour etre fiable"
    ],
    keywords: ['histogramme', 'distribution', 'dispersion des mesures', 'variabilite process', 'frequence des valeurs', 'process instable']
  },
  {
    id: 'diagramme-dispersion',
    name: 'Diagramme de dispersion',
    icon: '🔬',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Nuage de points qui teste visuellement une correlation potentielle entre deux variables (ex : une cause suspectee et un defaut), avant de conclure a un lien de cause a effet.",
    whenToUse: [
      "Hypothese de lien entre une cause potentielle et un effet mesurable",
      "Besoin de verifier objectivement une correlation avant d'agir",
      "Donnees chiffrees disponibles pour les deux variables"
    ],
    steps: [
      "Choisir la variable suspectee comme cause (axe X) et l'effet mesure (axe Y)",
      "Collecter des couples de valeurs (X,Y) sur un echantillon representatif",
      "Placer chaque couple comme un point sur le graphique",
      "Observer la forme du nuage : correlation positive, negative, ou absence de lien",
      "Confirmer la piste retenue par une analyse complementaire (5 Pourquoi, Ishikawa) avant d'agir"
    ],
    benefits: "Evite d'agir sur une fausse cause juste par intuition, teste objectivement une hypothese avec des donnees.",
    memo: [
      "Axe X = cause suspectee, Axe Y = effet mesure",
      "Nuage qui monte = correlation positive, qui descend = negative",
      "Nuage disperse sans forme = pas de lien visible",
      "Correlation n'est pas toujours causalite : rester prudent"
    ],
    keywords: ['diagramme de dispersion', 'nuage de points', 'correlation', 'lien cause effet', 'verifier une hypothese', 'scatter plot']
  },
  {
    id: 'carte-controle',
    name: 'Carte de controle (MSP)',
    icon: '📉',
    category: 'Qualite',
    phase: 'standardisation',
    summary: "Suivi dans le temps d'une caracteristique mesuree avec des limites de controle statistiques, pour distinguer la variabilite normale d'un process d'une derive reelle a corriger.",
    whenToUse: [
      "Process repetitif dont il faut surveiller la stabilite dans la duree",
      "Besoin de distinguer un incident isole d'une derive systematique",
      "Apres un chantier Kaizen, pour verifier que le gain se maintient (phase Control)"
    ],
    steps: [
      "Choisir la caracteristique critique a suivre (cote, poids, temps de cycle...)",
      "Collecter des mesures a intervalles reguliers (echantillons)",
      "Calculer la moyenne et les limites de controle statistiques (typiquement +/- 3 sigma)",
      "Tracer les points mesures dans le temps avec ces limites",
      "Reagir uniquement quand un point ou une tendance sort des limites de controle (pas a chaque variation normale)"
    ],
    benefits: "Evite de sur-reagir a la variabilite normale, detecte tot les vraies derives de process, perennise les gains d'un chantier Kaizen.",
    memo: [
      "Limites de controle statistiques, pas des limites de specification client",
      "Reagir seulement si un point sort des limites ou si une tendance anormale apparait",
      "Outil typique de la phase Control d'un DMAIC",
      "Ne pas confondre variabilite normale et derive reelle"
    ],
    keywords: ['carte de controle', 'msp', 'maitrise statistique des processus', 'spc', 'derive process', 'surveillance process', 'limites de controle']
  },
  {
    id: 'capabilite-process',
    name: 'Capabilite process (Cp/Cpk)',
    icon: '📏',
    category: 'Qualite',
    phase: 'analyse',
    summary: "Indicateur statistique qui compare la variabilite reelle d'un process aux tolerances specifiees, pour juger si le process est capable de produire durablement dans les specifications.",
    whenToUse: [
      "Verifier qu'un process de production est capable de tenir la tolerance client",
      "Comparer objectivement deux processus ou deux equipements",
      "Phase Measure/Analyze d'un DMAIC ou validation d'un nouveau process"
    ],
    steps: [
      "Collecter un echantillon representatif de mesures en process stable",
      "Calculer la moyenne et l'ecart-type du process",
      "Calculer le Cp (capabilite potentielle) : etendue de tolerance / etendue du process",
      "Calculer le Cpk (capabilite reelle) qui tient compte du centrage du process",
      "Interpreter : Cpk < 1 process non capable, Cpk >= 1.33 generalement considere satisfaisant"
    ],
    benefits: "Chiffre objectivement si un process tient ses tolerances, argumente un investissement ou un changement de process.",
    memo: [
      "Cp = capabilite potentielle (dispersion seule)",
      "Cpk = capabilite reelle (dispersion + centrage)",
      "Cpk >= 1.33 = process generalement satisfaisant (seuil courant, a adapter au secteur)",
      "Necessite un process stable (sous controle) pour etre interprete correctement"
    ],
    keywords: ['cp', 'cpk', 'capabilite process', 'capabilite machine', 'process capable', 'tolerance specification', 'ecart type process']
  },
  {
    id: 'charte-projet',
    name: 'Charte de projet',
    icon: '📃',
    category: 'Gestion de projet',
    phase: 'identification',
    summary: "Document de cadrage initial d'un projet ou chantier qui formalise son objectif, son perimetre, ses parties prenantes et ses contraintes avant le lancement operationnel.",
    whenToUse: [
      "Lancement officiel d'un chantier ou projet d'amelioration important",
      "Besoin d'un accord formel de la direction avant de mobiliser une equipe",
      "Plusieurs services impliques necessitant un cadrage partage"
    ],
    steps: [
      "Formuler l'objectif du projet et le probleme qu'il resout",
      "Definir le perimetre : ce qui est inclus et ce qui est explicitement exclu",
      "Identifier les parties prenantes : sponsor, pilote, equipe, parties consultees",
      "Lister les contraintes (delai, budget, ressources) et les risques majeurs",
      "Faire valider la charte par le sponsor avant de demarrer les travaux"
    ],
    benefits: "Evite les malentendus sur l'objectif et le perimetre, engage formellement la direction et les ressources necessaires.",
    memo: [
      "Objectif, perimetre (inclus/exclus), parties prenantes, contraintes",
      "Validee par le sponsor avant tout demarrage operationnel",
      "Document court (1-2 pages), pas un cahier des charges detaille",
      "A referencer tout au long du projet en cas de derive de perimetre"
    ],
    keywords: ['charte de projet', 'project charter', 'lancement de projet', 'cadrage initial', 'sponsor projet', 'perimetre projet']
  },
  {
    id: 'matrice-risques',
    name: 'Matrice des risques projet',
    icon: '🧯',
    category: 'Gestion de projet',
    phase: 'plan-action',
    summary: "Grille qui identifie et hierarchise les risques pouvant compromettre un chantier ou un projet, en croisant leur probabilite d'occurrence et leur impact potentiel.",
    whenToUse: [
      "Lancement d'un chantier ou projet avec des enjeux ou une duree significative",
      "Besoin d'anticiper ce qui pourrait faire echouer le projet",
      "Suivi regulier d'un projet complexe (revue de risques)"
    ],
    steps: [
      "Lister les risques potentiels du projet (techniques, humains, delais, budget)",
      "Evaluer chaque risque selon sa Probabilite d'occurrence et son Impact",
      "Positionner chaque risque dans une matrice Probabilite x Impact",
      "Definir un plan d'action pour les risques prioritaires (eviter, reduire, transferer, accepter)",
      "Revoir la matrice regulierement pendant la duree du projet"
    ],
    benefits: "Anticipe les obstacles plutot que de les subir, priorise les efforts de prevention sur les risques les plus critiques.",
    memo: [
      "Matrice Probabilite x Impact",
      "4 strategies possibles : eviter, reduire, transferer, accepter",
      "A revoir regulierement, pas juste au lancement",
      "Complementaire de l'AMDEC mais a l'echelle du projet, pas du produit/process"
    ],
    keywords: ['matrice des risques', 'risques projet', 'gestion des risques', 'anticiper les problemes projet', 'probabilite impact', 'risk management']
  },
  {
    id: 'flux-unitaire',
    name: 'Flux unitaire (One-Piece-Flow)',
    icon: '➡️',
    category: 'Organisation',
    phase: 'solution',
    summary: "Principe qui consiste a faire circuler les pieces une par une (ou par tres petits lots) entre les postes, plutot que par gros lots, pour reduire drastiquement le lead time et les stocks intermediaires.",
    whenToUse: [
      "Gros lots qui generent des stocks intermediaires importants entre postes",
      "Lead time long alors que le temps de traitement reel est court",
      "Reimplantation de ligne ou passage a une cellule en U envisage"
    ],
    steps: [
      "Cartographier le flux actuel et mesurer la taille des lots entre chaque poste",
      "Reduire progressivement la taille des lots (souvent en s'appuyant sur un SMED efficace)",
      "Rapprocher physiquement les postes pour limiter les transports et attentes",
      "Faire circuler une piece (ou un tres petit lot) a la fois d'un poste au suivant",
      "Stabiliser le nouveau flux et mesurer le gain de lead time"
    ],
    benefits: "Reduit drastiquement le lead time et les stocks intermediaires, rend les problemes qualite visibles immediatement (pas caches dans un gros lot).",
    memo: [
      "Une piece (ou un tres petit lot) circule a la fois, pas un gros lot",
      "S'appuie souvent sur un SMED performant pour rester rentable",
      "Rapprocher les postes physiquement facilite le flux unitaire",
      "Un defaut est detecte immediatement, pas apres tout un lot"
    ],
    keywords: ['flux unitaire', 'one piece flow', 'flux piece a piece', 'gros lots', 'reduire le lead time', 'cellule en u', 'stock entre les postes']
  },
  {
    id: 'obeya',
    name: 'Obeya (Salle de pilotage)',
    icon: '🏫',
    category: 'Pilotage',
    phase: 'plan-action',
    summary: "Salle de management visuel dediee ou l'equipe projet ou chantier affiche ses objectifs, indicateurs et plans d'action, pour piloter en un seul lieu et favoriser la coordination rapide.",
    whenToUse: [
      "Projet ou chantier avec plusieurs equipes a coordonner",
      "Informations de pilotage dispersees dans des fichiers ou reunions separees",
      "Besoin d'accelerer la prise de decision et la remontee des blocages"
    ],
    steps: [
      "Choisir un lieu (physique ou un mur/ecran dedie) accessible a toute l'equipe",
      "Afficher les objectifs, le planning, les indicateurs cles et le plan d'action",
      "Definir un rituel de reunion courte et reguliere devant ce management visuel",
      "Mettre a jour les affichages en continu, pas seulement lors des reunions",
      "Faire remonter et traiter les blocages directement depuis la salle"
    ],
    benefits: "Coordination plus rapide entre equipes, information de pilotage centralisee et toujours a jour, reduit les reunions eparpillees.",
    memo: [
      "Obeya = 'grande piece' en japonais, salle de pilotage dediee",
      "Tout le pilotage visible en un seul endroit",
      "Rituel court et regulier devant le mur visuel",
      "Mise a jour continue, pas juste au moment des reunions"
    ],
    keywords: ['obeya', 'salle de pilotage', 'management visuel', 'war room', 'coordination equipes', 'salle de projet']
  },
  {
    id: 'wbs',
    name: 'WBS (Structure de decoupage projet)',
    icon: '🌳',
    category: 'Gestion de projet',
    phase: 'plan-action',
    summary: "Decomposition hierarchique d'un projet en lots de travail plus petits et gerables, pour s'assurer que rien n'est oublie avant de planifier et d'affecter les ressources.",
    whenToUse: [
      "Projet ou chantier complexe avec de nombreuses taches a organiser",
      "Risque d'oublier des livrables ou des taches importantes",
      "Besoin de repartir le travail entre plusieurs equipes avant de planifier (Gantt)"
    ],
    steps: [
      "Partir du livrable final du projet",
      "Decomposer en grands lots de travail (niveau 1)",
      "Decomposer chaque lot en sous-taches gerables (niveau 2, 3...)",
      "Verifier que la somme des taches couvre bien 100% du perimetre, sans trou ni doublon",
      "Utiliser cette decomposition comme base pour le planning (Gantt) et les responsabilites (RACI)"
    ],
    benefits: "Rien n'est oublie, base fiable pour planifier et estimer, facilite la repartition du travail entre equipes.",
    memo: [
      "Partir du livrable final, puis decomposer en lots puis en taches",
      "Regle des 100% : toutes les taches ensemble couvrent tout le perimetre",
      "Sert de base au Gantt (planning) et au RACI (responsabilites)",
      "A faire avant de planifier, pas en meme temps"
    ],
    keywords: ['wbs', 'structure de decoupage projet', 'decomposition du projet', 'lots de travail', 'organiser un projet complexe', 'work breakdown structure']
  },
  {
    id: 'feuille-releve',
    name: 'Feuille de releve',
    icon: '📝',
    category: 'Diagnostic',
    phase: 'analyse',
    summary: "Support simple et standardise de collecte de donnees terrain (comptage, pointage) qui garantit une saisie fiable et exploitable avant toute analyse (Pareto, Histogramme...).",
    whenToUse: [
      "Besoin de donnees fiables avant de lancer un Pareto ou un Histogramme",
      "Collecte manuelle sur le terrain par plusieurs operateurs",
      "Suspicion de probleme mais aucune donnee chiffree encore disponible"
    ],
    steps: [
      "Definir precisement ce qui doit etre releve (quel defaut, quelle mesure)",
      "Concevoir un support simple : cases a cocher ou a remplir, sans ambiguite",
      "Former les operateurs a remplir la feuille de la meme facon",
      "Collecter sur une periode representative",
      "Compiler les donnees pour alimenter un Pareto, un Histogramme ou une carte de controle"
    ],
    benefits: "Donnees fiables et comparables des la source, evite les analyses biaisees par une collecte approximative.",
    memo: [
      "Support simple, sans ambiguite, rempli directement sur le terrain",
      "Tout le monde doit remplir la feuille de la meme facon",
      "Etape prealable classique a un Pareto ou un Histogramme",
      "La qualite de l'analyse depend de la qualite de cette collecte"
    ],
    keywords: ['feuille de releve', 'check sheet', 'collecte de donnees terrain', 'comptage defauts', 'pointage', 'fiabiliser les donnees']
  },
  {
    id: 'retour-experience',
    name: 'Retour d\'experience (REX)',
    icon: '📚',
    category: 'Pilotage',
    phase: 'standardisation',
    summary: "Bilan structure realise a la fin d'un chantier Kaizen pour capitaliser ce qui a bien ou mal fonctionne, et ne pas repeter les memes erreurs sur les chantiers suivants.",
    whenToUse: [
      "Cloture d'un chantier Kaizen ou d'un projet",
      "Difficultes rencontrees pendant le chantier meritant d'etre partagees",
      "Besoin de capitaliser l'experience pour les futurs chantiers similaires"
    ],
    steps: [
      "Reunir l'equipe rapidement apres la fin du chantier (a chaud)",
      "Lister ce qui a bien fonctionne et doit etre reproduit",
      "Lister ce qui a pose probleme et pourquoi (sans chercher de coupable)",
      "Identifier les enseignements et les actions pour les chantiers futurs",
      "Diffuser le REX aux autres equipes ou pilotes de chantiers"
    ],
    benefits: "Capitalise l'experience collective, evite de repeter les memes erreurs, ameliore la maniere de mener les chantiers suivants.",
    memo: [
      "A faire a chaud, juste apres la fin du chantier",
      "Ce qui a marche + ce qui a pose probleme + enseignements",
      "Sans chercher de coupable : esprit d'amelioration, pas de sanction",
      "A diffuser pour que les autres chantiers en profitent"
    ],
    keywords: ['rex', 'retour d\'experience', 'lessons learned', 'bilan de chantier', 'cloture de projet', 'capitaliser l\'experience']
  }
];

const TOOLS_BY_ID = Object.fromEntries(TOOLS.map(t => [t.id, t]));

module.exports = { TOOLS, TOOLS_BY_ID, PHASES, PHASES_BY_ID };
