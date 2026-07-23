# Reprendre le projet sur un autre ordinateur

Tout le code est sauvegarde sur GitHub : https://github.com/louisparis10-prog/Kaizen
C'est ca, ta copie complete — pas besoin de transferer des fichiers a la main.

## 1. Installer les outils de base (si pas deja fait)
- Node.js version 18 ou plus (https://nodejs.org)
- Git (deja installe sur Mac en general)

## 2. Recuperer le code
```
git clone git@github.com:louisparis10-prog/Kaizen.git
cd Kaizen
npm install
```

Si `git clone` demande une authentification et refuse (`Permission denied` ou `Repository not found`) :
c'est qu'il faut ajouter une cle SSH de CE nouveau PC a ton compte GitHub (meme procedure que la premiere fois) :
```
ssh-keygen -t ed25519 -C "ton-email" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
Copie la cle affichee sur https://github.com/settings/ssh/new, puis relance `git clone`.

## 3. Lancer l'appli en local
```
npm start
```
Ouvre http://localhost:3001

Pour activer le chat IA en local, il faut la variable d'environnement avec ta cle Anthropic :
```
ANTHROPIC_API_KEY=sk-ant-... npm start
```
(La cle n'est pas dans le code, uniquement configuree sur Render — c'est normal et voulu.)

## 4. Deployer les modifications
Le service Render est deja connecte au repo GitHub avec le deploiement automatique active.
Donc depuis le nouveau PC, il suffit de faire un `git push` normal :
```
git add -A
git commit -m "..."
git push origin main
```
Render redeploie automatiquement en 1-2 minutes. Pas besoin de reinstaller le CLI Render
sauf si tu veux gerer les variables d'environnement ou consulter les logs depuis le terminal.

## Liens utiles
- Application en ligne : https://kaizen-app-lx1y.onrender.com
- Repo GitHub : https://github.com/louisparis10-prog/Kaizen
- Dashboard Render : https://dashboard.render.com

## A savoir
- La base de donnees (chantiers, actions, photos) est sur le disque Render, qui est
  **efface a chaque redeploiement** (plan gratuit). Le code, lui, n'est jamais perdu (GitHub).
