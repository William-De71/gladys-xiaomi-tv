# Xiaomi TV

## Présentation

Cette intégration amène votre **téléviseur Xiaomi** dans Gladys : l’allumer ou le mettre en veille, régler son volume, appuyer sur les touches de sa télécommande, ouvrir ses applications et changer d’entrée HDMI, depuis le tableau de bord et depuis vos scènes.

Elle fonctionne avec les téléviseurs Xiaomi sous **MIUI TV / PatchWall**, qui répondent sur le port 6095 du réseau local (l’API qu’utilise l’application Mi Remote). Tout reste sur votre **réseau local** : ni compte, ni appairage, ni cloud. **Les modèles Android TV et Google TV** (Mi TV P1, Q1, Q2, Xiaomi TV A / A Pro…) **n’ont pas ce port** : cette intégration ne peut pas les piloter.

## Prérequis

- Gladys Assistant 5.2.0 ou plus récent.
- Un téléviseur Xiaomi sous MIUI TV / PatchWall, allumé et connecté au **même réseau que Gladys**. Pour le vérifier : ouvrez `http://<adresse du téléviseur>:6095/request?action=isalive` dans un navigateur ; le téléviseur répond avec son nom.
- À l’installation, acceptez la **découverte réseau** (SSDP), qui permet à Gladys de trouver les téléviseurs, et le **Wake-on-LAN**, qui permet à l’intégration d’allumer un téléviseur qui ne répond plus.

## Configuration

### Recherche

Rien à remplir dans la plupart des maisons : allumez le téléviseur et appuyez sur **Rechercher et tester les téléviseurs**. Le message liste chaque téléviseur trouvé avec son adresse, son adresse MAC et s’il répond.

Un téléviseur que la recherche ne trouve pas (autre sous-réseau, réseau qui filtre le multicast) : saisissez son adresse dans **Adresses IP**, séparées par des virgules, puis enregistrez.

Donnez au téléviseur une **adresse IP fixe** dans votre box : l’intégration retrouve un téléviseur dont l’adresse a changé (grâce à son adresse MAC), mais plus vite avec une adresse fixe.

### Actualisation et langue

- **Actualisation de l’état** : chaque téléviseur est interrogé (répond-il, quel est son volume) toutes les 10 secondes (par défaut), 30 secondes ou 1 minute.
- **Recherche automatique** : le réseau est de nouveau exploré toutes les heures (par défaut), tous les quarts d’heure, ou jamais ; un téléviseur qui ne répond plus déclenche de toute façon une recherche.
- **Langue des textes des appareils** : les noms des fonctionnalités dans l’onglet Découverte et les messages d’erreur des scènes sont écrits dans cette langue, car Gladys ne leur transmet pas la vôtre.

## Utilisation

### Appareils

Ouvrez l’onglet **Découverte** de l’intégration : chaque téléviseur trouvé y figure. Ajoutez-le et renommez-le à votre guise. Un téléviseur a ces fonctionnalités :

- **Marche/veille** : la touche marche de la télécommande.
- **Volume** : un curseur de 0 au maximum du téléviseur.
- **Augmenter volume**, **Diminuer volume**, **Muet**, **Haut**, **Bas**, **Gauche**, **Droite**, **OK**, **Menu**, **Retour** : des boutons de la télécommande.

Le badge du téléviseur indique **local**, ou **injoignable** quand il ne répond pas.

**L’état marche/veille est supposé.** La touche marche fait passer le téléviseur de la marche à la veille et inversement, et un téléviseur en veille répond toujours sur le réseau : l’intégration ne peut pas les distinguer. L’état est donc la dernière commande envoyée depuis Gladys, **allumé** quand le téléviseur se remet à répondre, **éteint** quand il ne répond plus. Si vous le mettez en veille avec sa propre télécommande, Gladys le montre toujours allumé : appuyez deux fois sur le bouton pour resynchroniser. Allumer un téléviseur qui ne répond pas envoie un **Wake-on-LAN** quand son adresse MAC est connue.

Le téléviseur n’a pas de touche sourdine : **Muet** baisse le volume à 0, et un nouvel appui rétablit le volume d’avant. Le volume est atteint avec les touches de volume (la requête directe du téléviseur exige une signature qui n’est pas publique) : un grand écart prend quelques secondes.

### Widgets

![Le widget « Téléviseur Xiaomi » : le téléviseur du salon allumé, volume 18, ses six premières applications avec leur nom de paquet et quatre boutons ; le téléviseur de la chambre qui ne répond pas, avec son bouton Allumer (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-xiaomi-tv/main/docs/assets/widgets.fr.png)

**Téléviseur Xiaomi** : un téléviseur choisi dans les réglages, avec son état, son adresse, son volume, ses six premières applications (icône, nom et nom de paquet) et quatre boutons : **Mettre en veille** / **Allumer**, **Accueil**, **Sourdine** / **Rétablir le son** et **Ouvrir une appli**, qui ouvre un formulaire listant toutes les applications du téléviseur. Quand le téléviseur ne répond pas, seul **Allumer** reste (si le Wake-on-LAN est possible).

### Actions de scène

- **Ouvrir une appli sur un téléviseur Xiaomi** : le nom de l’application tel qu’affiché sur le téléviseur (`Netflix`, `YouTube` ; majuscules et accents indifférents) ou son nom de paquet (`com.netflix.ninja`, listé par le widget). Transmet `app_name` et `package` aux actions suivantes.
- **Appuyer sur des touches d’un téléviseur Xiaomi** : jusqu’à 30 touches séparées par des virgules (`home, down, down, enter`) parmi `power`, `up`, `down`, `left`, `right`, `enter`, `home`, `back`, `menu`, `volumeup`, `volumedown`, avec une pause entre elles (700 ms par défaut). Transmet `keys_sent`.
- **Changer l’entrée d’un téléviseur Xiaomi** : HDMI 1, HDMI 2 ou HDMI 3.

L’intégration n’a pas de déclencheur de scène : le téléviseur n’envoie aucun événement. Pour lancer une scène quand le téléviseur s’allume, utilisez le déclencheur de Gladys « Changement d’état de l’appareil » sur sa fonctionnalité **Marche/veille**.

### Exemples de scènes

- Tous les soirs à 20 h 30, si quelqu’un est à la maison → **Ouvrir une appli sur un téléviseur Xiaomi** `Netflix`, puis lumières du salon à 20 %.
- **L’état Marche/veille du téléviseur passe à 1** → fermer les volets du salon et tamiser les lumières.
- Quand la console de jeux s’allume → **Changer l’entrée d’un téléviseur Xiaomi** sur HDMI 2, puis volume à 30.

## Dépannage

- **Aucun téléviseur trouvé** : vérifiez qu’il est allumé, sur le même réseau que Gladys (pas un réseau invité) et que `http://<adresse du téléviseur>:6095/request?action=isalive` répond dans un navigateur. Sinon, votre modèle n’a pas cette API (modèles Android TV et Google TV). Sinon encore, saisissez son adresse dans la configuration.
- **« Gladys a refusé la recherche réseau »** : réinstallez l’intégration en acceptant sa découverte réseau, ou saisissez l’adresse du téléviseur.
- **Le téléviseur apparaît allumé alors qu’il est en veille** (ou l’inverse) : l’état est supposé, voir plus haut. Appuyez deux fois sur Marche/veille.
- **Le téléviseur ne s’allume pas depuis la veille ou l’arrêt** : en veille profonde, certains téléviseurs ignorent le Wake-on-LAN ; allumez-le avec sa télécommande. Un téléviseur trouvé seulement par son adresse saisie n’a pas d’adresse MAC connue : pas de Wake-on-LAN.
- **Le volume ne change pas** : le son passe peut-être par un appareil audio externe (HDMI ARC, optique) dont le téléviseur ne règle pas le volume.
- **Une application ne s’ouvre pas** : vérifiez son nom dans le widget, ou utilisez son nom de paquet.
- Journaux : l’onglet Journaux de l’intégration ; ajoutez `DEBUG=gladys-integration-sdk` au conteneur pour le détail. Signalez un problème sur [GitHub](https://github.com/William-De71/gladys-xiaomi-tv/issues) avec votre version de Gladys, la version de l’intégration, le modèle du téléviseur et les journaux.
