// Bibliotheque des outils Lean / Kaizen.
// keywords: sert au moteur de chat local pour orienter vers le bon outil.

const TOOLS = [
  {
    id: '5s',
    name: '5S',
    icon: '🧹',
    category: 'Organisation',
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
    keywords: ['5s', 'rangement', 'desordre', 'desordonne', 'encombre', 'poste de travail sale', 'trier', 'ranger', 'nettoyer poste', 'organisation atelier', 'objets qui trainent', 'perte de temps a chercher']
  },
  {
    id: 'pdca',
    name: 'PDCA (Roue de Deming)',
    icon: '🔄',
    category: 'Pilotage',
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
    keywords: ['pdca', 'roue de deming', 'demarche amelioration', 'plan do check act', 'methode generale', 'comment structurer', 'piloter un chantier']
  },
  {
    id: 'ishikawa',
    name: 'Diagramme d\'Ishikawa (5M)',
    icon: '🐟',
    category: 'Diagnostic',
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
    keywords: ['ishikawa', 'arete de poisson', 'diagramme causes', 'cause effet', '5m', 'cause racine', 'pourquoi le probleme arrive', 'panne recurrente', 'defaut qualite recurrent']
  },
  {
    id: '5-pourquoi',
    name: '5 Pourquoi',
    icon: '❓',
    category: 'Diagnostic',
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
    keywords: ['5 pourquoi', 'pourquoi pourquoi', 'cause racine', 'root cause', 'analyse rapide', 'probleme ponctuel']
  },
  {
    id: 'pareto',
    name: 'Diagramme de Pareto',
    icon: '📊',
    category: 'Diagnostic',
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
    keywords: ['pareto', '80/20', 'prioriser', 'quels defauts traiter en premier', 'classement des causes', 'top defauts']
  },
  {
    id: 'qqoqccp',
    name: 'QQOQCCP',
    icon: '📋',
    category: 'Diagnostic',
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
    keywords: ['qqoqccp', 'cadrage', 'cadrer le probleme', 'definir le probleme', 'perimetre du chantier', 'grille de questionnement']
  },
  {
    id: 'vsm',
    name: 'VSM (Value Stream Mapping)',
    icon: '🗺️',
    category: 'Diagnostic',
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
    keywords: ['vsm', 'value stream mapping', 'cartographie des flux', 'chaine de valeur', 'lead time', 'flux d\'information', 'stocks intermediaires']
  },
  {
    id: 'spaghetti',
    name: 'Diagramme Spaghetti',
    icon: '🍝',
    category: 'Diagnostic',
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
    keywords: ['spaghetti', 'deplacements inutiles', 'trajet', 'reimplantation', 'distance parcourue', 'aller retour']
  },
  {
    id: 'smed',
    name: 'SMED',
    icon: '⏱️',
    category: 'Organisation',
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
    keywords: ['smed', 'changement de serie', 'changement de format', 'changement de reference', 'reglage machine long', 'temps de changement outillage', 'arret machine pour reglage', 'temps d\'attente entre les series', 'temps d\'attente entre changements']
  },
  {
    id: 'kanban',
    name: 'Kanban',
    icon: '🗂️',
    category: 'Organisation',
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
    keywords: ['kanban', 'flux tire', 'stock intermediaire', 'reapprovisionnement', 'tableau visuel', 'suivi des taches', 'planche kanban']
  },
  {
    id: 'poka-yoke',
    name: 'Poka-Yoke',
    icon: '🛡️',
    category: 'Qualite',
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
    keywords: ['poka-yoke', 'anti erreur', 'detrompeur', 'erreur humaine', 'oubli piece', 'montage incorrect', 'erreur de montage', 'securite erreur']
  },
  {
    id: 'standard-work',
    name: 'Standard Work',
    icon: '📐',
    category: 'Organisation',
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
    keywords: ['standard work', 'mode operatoire', 'procedure standard', 'variabilite operateur', 'formation nouvel arrivant', 'meilleure pratique']
  },
  {
    id: 'tpm',
    name: 'TPM (Maintenance Productive Totale)',
    icon: '🔧',
    category: 'Qualite',
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
    keywords: ['tpm', 'maintenance', 'panne', 'trs', 'oeed', 'oee', 'arret machine', 'disponibilite machine', 'auto maintenance']
  },
  {
    id: 'andon',
    name: 'Andon',
    icon: '🚨',
    category: 'Qualite',
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
    keywords: ['andon', 'alerte visuelle', 'signal lumineux', 'arreter la ligne', 'signaler un probleme', 'reactivite']
  },
  {
    id: 'jidoka',
    name: 'Jidoka',
    icon: '🤖',
    category: 'Qualite',
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
    keywords: ['jidoka', 'arret automatique', 'defaut transmis', 'controle qualite poste', 'detection anomalie automatique']
  },
  {
    id: 'heijunka',
    name: 'Heijunka (Lissage)',
    icon: '📈',
    category: 'Organisation',
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
    keywords: ['heijunka', 'lissage', 'lissage production', 'a coups de charge', 'gros lots', 'planification irreguliere']
  },
  {
    id: 'takt-time',
    name: 'Takt Time',
    icon: '⏲️',
    category: 'Organisation',
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
    keywords: ['takt time', 'cadence', 'rythme de production', 'equilibrage de ligne', 'temps de cycle vs demande']
  },
  {
    id: 'a3',
    name: 'Rapport A3',
    icon: '📄',
    category: 'Pilotage',
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
    keywords: ['a3', 'rapport a3', 'synthese chantier', 'presentation projet', 'reporting kaizen', 'fiche projet amelioration']
  },
  {
    id: 'gemba-walk',
    name: 'Gemba Walk',
    icon: '🚶',
    category: 'Pilotage',
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
    keywords: ['gemba', 'gemba walk', 'aller sur le terrain', 'observation terrain', 'verifier le standard', 'management visuel terrain']
  },
  {
    id: 'kata-kaizen',
    name: 'Kata Kaizen',
    icon: '🥋',
    category: 'Pilotage',
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
    keywords: ['kata', 'kata kaizen', 'routine amelioration continue', 'culture kaizen', 'amelioration quotidienne', 'petits pas']
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming & Vote pondere',
    icon: '💡',
    category: 'Pilotage',
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
    keywords: ['brainstorming', 'vote pondere', 'idees', 'creativite groupe', 'choisir une solution', 'consensus equipe']
  }
];

const TOOLS_BY_ID = Object.fromEntries(TOOLS.map(t => [t.id, t]));

module.exports = { TOOLS, TOOLS_BY_ID };
