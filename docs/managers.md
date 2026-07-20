# 👥 Gestion des managers

> 🇬🇧 [English version](managers.en.md)

Praxis introduit un système de comptes individuels avec deux rôles distincts, remplaçant le mot de passe global unique de Razzia.

---

## Rôles

### Manager

- Accède au tableau de bord `/manager/dashboard`
- Crée, modifie et supprime **ses propres quiz**
- Consulte les **quiz publics** et les **quiz partagés** avec lui
- Consulte et partage **ses propres résultats**
- Lance des parties

### Superadmin

Dispose de toutes les capacités du manager, plus :

- **Gestion des comptes** — créer, modifier, supprimer des comptes managers
- **Quiz** — accès en lecture/écriture sur tous les quiz de tous les managers
- **Résultats** — accès en lecture sur tous les résultats
- **Apparence** — personnalisation du branding (couleurs, sons, logo…)

---

## Créer le premier compte (setup initial)

Au premier démarrage, accéder à `/setup` pour créer le compte superadmin initial. Cette page n'est accessible qu'une seule fois.

Voir [Démarrage rapide](demarrage.md) pour les détails.

---

## Gérer les comptes (superadmin)

Depuis `/manager/dashboard`, onglet **Comptes** :

### Créer un compte

1. Cliquer sur **Créer un compte**
2. Renseigner l'identifiant et le mot de passe
3. Choisir le rôle : **Manager** ou **Super Admin**
4. Valider

### Modifier un compte

Cliquer sur l'icône ✏️ en face du compte. Il est possible de modifier :
- L'identifiant
- Le mot de passe (laisser vide pour ne pas le changer)
- Le rôle

### Supprimer un compte

Cliquer sur l'icône 🗑️. Un superadmin ne peut pas supprimer son propre compte.

---

## Changer son mot de passe

Tout manager peut changer son propre mot de passe depuis le dashboard, quel que soit son rôle.

1. Cliquer sur l'icône **clé** (🔑) dans le header du dashboard
2. Saisir le mot de passe actuel
3. Saisir le nouveau mot de passe (minimum 8 caractères) et le confirmer
4. Cliquer sur **Enregistrer**

Chaque champ dispose d'un bouton 👁 pour afficher/masquer les caractères.

Après un changement réussi, une fenêtre propose de **déconnecter toutes les autres sessions actives** (autres navigateurs ou appareils). Si aucune autre session n'est active, un simple message de confirmation s'affiche.

> Le superadmin peut également modifier le mot de passe de n'importe quel manager depuis l'onglet **Comptes** sans connaître l'ancien mot de passe.

---

## Authentification

- Connexion via `/manager` (identifiant + mot de passe)
- Session stockée dans un cookie **HttpOnly** + **SameSite=Strict** — inaccessible depuis JavaScript
- Durée de session configurable via les paramètres globaux
- **Rate limiting** — 5 tentatives de connexion échouées → blocage de l'IP pendant 15 minutes
- **Audit log** — toutes les connexions, créations et suppressions sont tracées

---

## Interface Legacy

L'interface originale de Razzia reste accessible sur `/legacy` avec le mot de passe défini dans `config/game.json`. Elle est maintenue pour la compatibilité et fonctionne indépendamment du système de comptes.

---

Retour à l'[index de la documentation](README.md).
