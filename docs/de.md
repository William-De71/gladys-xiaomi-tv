# Xiaomi TV

## Überblick

Diese Integration bringt Ihren **Xiaomi-Fernseher** in Gladys: einschalten oder in den Standby schicken, die Lautstärke einstellen, die Tasten der Fernbedienung drücken, Apps öffnen und den HDMI-Eingang wechseln – über das Dashboard und in Ihren Szenen.

Sie funktioniert mit Xiaomi-Fernsehern mit **MIUI TV / PatchWall**, die im lokalen Netzwerk auf Port 6095 antworten (die API der App Mi Remote). Alles bleibt in Ihrem **lokalen Netzwerk**: kein Konto, keine Kopplung, keine Cloud. **Modelle mit Android TV und Google TV** (Mi TV P1, Q1, Q2, Xiaomi TV A / A Pro…) **haben diesen Port nicht**: Diese Integration kann sie nicht steuern.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein Xiaomi-Fernseher mit MIUI TV / PatchWall, eingeschaltet und mit **demselben Netzwerk wie Gladys** verbunden. Zur Prüfung: Öffnen Sie `http://<Adresse des Fernsehers>:6095/request?action=isalive` im Browser; der Fernseher antwortet mit seinem Namen.
- Akzeptieren Sie bei der Installation die **Netzwerkerkennung** (SSDP), mit der Gladys die Fernseher findet, und **Wake-on-LAN**, mit dem die Integration einen Fernseher einschaltet, der nicht mehr antwortet.

## Konfiguration

### Suche

In den meisten Haushalten ist nichts auszufüllen: Schalten Sie den Fernseher ein und drücken Sie **Fernseher suchen und testen**. Die Meldung listet jeden gefundenen Fernseher mit Adresse, MAC-Adresse und Erreichbarkeit auf.

Ein Fernseher, den die Suche nicht findet (anderes Subnetz, Netzwerk, das Multicast filtert): Geben Sie seine Adresse unter **IP-Adressen** ein, durch Kommas getrennt, und speichern Sie.

Geben Sie dem Fernseher im Router eine **feste IP-Adresse**: Die Integration findet einen Fernseher mit geänderter Adresse wieder (über seine MAC-Adresse), mit fester Adresse aber schneller.

### Aktualisierung und Sprache

- **Zustandsaktualisierung**: Jeder Fernseher wird alle 10 Sekunden (Standard), 30 Sekunden oder 1 Minute gefragt, ob er antwortet und wie laut er ist.
- **Automatische Suche**: Das Netzwerk wird jede Stunde (Standard), alle 15 Minuten oder nie erneut durchsucht; ein Fernseher, der nicht mehr antwortet, löst ohnehin eine Suche aus.
- **Sprache der Gerätetexte**: Die Funktionsnamen im Tab Entdecken und die Fehlermeldungen der Szenen werden in dieser Sprache geschrieben, weil Gladys Ihre Sprache dabei nicht mitsendet.

## Verwendung

### Geräte

Öffnen Sie den Tab **Entdecken** der Integration: Jeder gefundene Fernseher wird aufgelistet. Fügen Sie ihn hinzu und benennen Sie ihn nach Belieben um. Ein Fernseher hat diese Funktionen:

- **Ein/Standby**: die Ein-/Aus-Taste der Fernbedienung.
- **Lautstärke**: ein Schieberegler von 0 bis zum Maximum des Fernsehers.
- **Lautstärke höher**, **Lautstärke niedriger**, **Stumm**, **Hoch**, **Runter**, **Links**, **Rechts**, **Bestätigen**, **Menü**, **Zurück**: Tasten der Fernbedienung.

Das Abzeichen des Fernsehers zeigt **lokal** oder **nicht erreichbar**, wenn er nicht antwortet.

**Der Ein/Standby-Zustand ist angenommen.** Die Ein-/Aus-Taste schaltet den Fernseher zwischen Betrieb und Standby um, und ein Fernseher im Standby antwortet weiterhin im Netzwerk: Die Integration kann beides nicht unterscheiden. Der Zustand ist daher der letzte von Gladys gesendete Befehl, **ein**, sobald der Fernseher wieder antwortet, **aus**, wenn er nicht mehr antwortet. Schicken Sie ihn mit seiner eigenen Fernbedienung in den Standby, zeigt Gladys ihn weiterhin als eingeschaltet: Drücken Sie die Taste zweimal, um den Zustand abzugleichen. Einen Fernseher einzuschalten, der nicht antwortet, sendet **Wake-on-LAN**, wenn seine MAC-Adresse bekannt ist.

Der Fernseher hat keine Stummtaste: **Stumm** senkt die Lautstärke auf 0, ein erneuter Druck stellt die vorherige Lautstärke wieder her. Die Lautstärke wird mit den Lautstärketasten erreicht (die direkte Lautstärkeanfrage des Fernsehers verlangt eine nicht öffentliche Signatur): Eine große Änderung dauert ein paar Sekunden.

### Widgets

![Das Widget „Xiaomi-Fernseher“: der Wohnzimmerfernseher eingeschaltet, Lautstärke 18, seine ersten sechs Apps mit Paketnamen und vier Tasten; der Schlafzimmerfernseher antwortet nicht, mit seiner Taste Einschalten (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-xiaomi-tv/main/docs/assets/widgets.de.png)

**Xiaomi-Fernseher**: ein in den Einstellungen gewählter Fernseher mit Zustand, Adresse, Lautstärke, seinen ersten sechs Apps (Symbol, Name und Paketname) und vier Tasten: **Standby** / **Einschalten**, **Startseite**, **Stumm** / **Ton an** und **App öffnen**, die ein Formular mit allen Apps des Fernsehers öffnet. Antwortet der Fernseher nicht, bleibt nur **Einschalten** (wenn Wake-on-LAN möglich ist).

### Szenenaktionen

- **App auf einem Xiaomi-Fernseher öffnen**: der Name der App wie auf dem Fernseher angezeigt (`Netflix`, `YouTube`; Groß-/Kleinschreibung und Akzente egal) oder ihr Paketname (`com.netflix.ninja`, im Widget aufgelistet). Gibt `app_name` und `package` an die folgenden Aktionen weiter.
- **Tasten eines Xiaomi-Fernsehers drücken**: bis zu 30 Tasten, durch Kommas getrennt (`home, down, down, enter`), aus `power`, `up`, `down`, `left`, `right`, `enter`, `home`, `back`, `menu`, `volumeup`, `volumedown`, mit einer Pause dazwischen (standardmäßig 700 ms). Gibt `keys_sent` weiter.
- **Eingang eines Xiaomi-Fernsehers wechseln**: HDMI 1, HDMI 2 oder HDMI 3.

Die Integration hat keinen Szenenauslöser: Der Fernseher sendet keine Ereignisse. Um eine Szene beim Einschalten des Fernsehers zu starten, nutzen Sie den Gladys-Auslöser „Änderung von Gerätestatus“ auf seiner Funktion **Ein/Standby**.

### Szenenbeispiele

- Jeden Abend um 20:30 Uhr, wenn jemand zu Hause ist → **App auf einem Xiaomi-Fernseher öffnen** `Netflix`, dann Wohnzimmerlicht auf 20 %.
- **Der Ein/Standby-Zustand des Fernsehers wird 1** → Wohnzimmerrollläden schließen und das Licht dimmen.
- Wenn die Spielkonsole eingeschaltet wird → **Eingang eines Xiaomi-Fernsehers wechseln** auf HDMI 2, dann Lautstärke auf 30.

## Fehlerbehebung

- **Kein Fernseher gefunden**: Prüfen Sie, ob er eingeschaltet und im selben Netzwerk wie Gladys ist (kein Gastnetz) und ob `http://<Adresse des Fernsehers>:6095/request?action=isalive` im Browser antwortet. Wenn nicht, hat Ihr Modell diese API nicht (Modelle mit Android TV und Google TV). Andernfalls geben Sie seine Adresse in der Konfiguration ein.
- **„Gladys hat die Netzwerksuche abgelehnt“**: Installieren Sie die Integration neu und erlauben Sie ihre Netzwerkerkennung, oder geben Sie die Adresse des Fernsehers ein.
- **Der Fernseher wird als eingeschaltet angezeigt, obwohl er im Standby ist** (oder umgekehrt): Der Zustand ist angenommen, siehe oben. Drücken Sie Ein/Standby zweimal.
- **Der Fernseher schaltet sich aus dem Standby oder ausgeschaltet nicht ein**: Im tiefen Standby ignorieren manche Fernseher Wake-on-LAN; schalten Sie ihn mit der Fernbedienung ein. Ein nur über seine eingegebene Adresse gefundener Fernseher hat keine bekannte MAC-Adresse: kein Wake-on-LAN.
- **Die Lautstärke ändert sich nicht**: Der Ton läuft vielleicht über ein externes Audiogerät (HDMI ARC, optisch), dessen Lautstärke der Fernseher nicht regelt.
- **Eine App öffnet sich nicht**: Prüfen Sie ihren Namen im Widget, oder verwenden Sie ihren Paketnamen.
- Protokolle: der Tab Protokolle der Integration; fügen Sie dem Container `DEBUG=gladys-integration-sdk` hinzu, um Details zu sehen. Melden Sie ein Problem auf [GitHub](https://github.com/William-De71/gladys-xiaomi-tv/issues) mit Ihrer Gladys-Version, der Version der Integration, dem Modell des Fernsehers und den Protokollen.
