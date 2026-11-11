'use strict';

/* =========================================================
   EINGEBAUTE LEBENSMITTEL – Grundnahrungsmittel und typische Gerichte

   Damit findet die Suche auch Lebensmittel, die noch nie gescannt oder
   eingetragen wurden – sofort und ohne Internet. Die Werte sind übliche
   Richtwerte pro 100 g (bzw. 100 ml) aus Nährwerttabellen; einzelne
   Produkte können abweichen. Kohlenhydrate ohne Ballaststoffe, wie auf
   deutschen Verpackungen.

   Zeile: Name | kcal | Eiweiß | Kohlenhydrate | Fett | Portion (g/ml) |
          Portionsname | weitere Suchwörter | Einheit (leer = g, sonst ml)
   ========================================================= */

const FOOD_DB_RAW = `
# Obst
Apfel|52|0.3|11.4|0.2|150|Stück|äpfel
Banane|89|1.1|20|0.3|120|Stück|bananen
Birne|55|0.5|12.4|0.3|160|Stück|birnen
Orange|47|0.9|9.4|0.2|180|Stück|apfelsine orangen
Mandarine|50|0.7|10.5|0.3|70|Stück|clementine mandarinen
Grapefruit|40|0.7|8.5|0.1|250|Stück|pampelmuse
Erdbeeren|32|0.7|5.5|0.4|150|Portion|erdbeere
Himbeeren|40|1.3|4.8|0.3|125|Portion|himbeere
Heidelbeeren|57|0.7|12.1|0.3|125|Portion|blaubeeren
Brombeeren|43|1.4|5|0.5|125|Portion|
Beerenmischung (TK)|45|1|7|0.4|150|Portion|tiefkühlbeeren waldbeeren beeren
Kirschen|63|1.1|14|0.2|150|Portion|süßkirschen
Weintrauben|69|0.7|16.5|0.2|150|Portion|trauben
Pfirsich|41|0.9|8.9|0.1|150|Stück|
Nektarine|44|1.1|8.9|0.3|140|Stück|
Aprikose|45|1|8.8|0.2|45|Stück|marille aprikosen
Pflaume|47|0.6|10.2|0.2|40|Stück|zwetschge pflaumen
Kiwi|61|1.1|11.7|0.5|75|Stück|
Mango|60|0.8|13.4|0.4|150|Portion|
Ananas|52|0.5|12|0.1|150|Portion|
Wassermelone|30|0.6|7.2|0.2|250|Portion|melone
Honigmelone|36|0.5|8.3|0.1|200|Portion|melone
Papaya|43|0.5|9.1|0.3|150|Portion|
Granatapfel|83|1.7|14.7|1.2|150|Portion|granatapfelkerne
Avocado|160|2|1.8|14.7|75|Hälfte|
Datteln (getrocknet)|282|2.5|67|0.4|10|Stück|dattel
Rosinen|299|3.1|75|0.5|25|Handvoll|sultaninen
Feigen (getrocknet)|249|3.3|54|0.9|20|Stück|feige
Aprikosen (getrocknet)|241|3.4|55|0.5|8|Stück|trockenaprikosen
Trockenpflaumen|240|2.2|57|0.4|10|Stück|backpflaumen
Cranberries (getrocknet)|308|0.1|77|1.1|25|Handvoll|
Apfelmus|77|0.2|18|0.1|125|Portion|apfelmark
Kokosraspeln|660|6.9|7.4|64.5|10|EL|kokosflocken
Oliven|145|1|0.5|15.3|30|Portion|grüne oliven schwarze oliven

# Gemüse
Tomate|18|0.9|2.7|0.2|100|Stück|tomaten cherrytomaten cocktailtomaten
Gurke|15|0.7|3.1|0.1|100|Portion|salatgurke
Paprika|31|1|4.2|0.3|150|Stück|paprikaschote
Karotte|41|0.9|6.8|0.2|80|Stück|möhre mohrrübe karotten möhren
Brokkoli|34|2.8|4|0.4|150|Portion|broccoli
Blumenkohl|25|1.9|3|0.3|150|Portion|
Spinat|23|2.9|1.4|0.4|100|Portion|blattspinat
Rahmspinat (TK)|57|2.7|3.2|3.3|150|Portion|
Zucchini|17|1.2|2.1|0.3|200|Stück|
Aubergine|25|1|2.9|0.2|250|Stück|
Zwiebel|40|1.1|7.6|0.1|80|Stück|zwiebeln
Frühlingszwiebel|32|1.8|4.7|0.2|15|Stück|lauchzwiebel
Knoblauch|149|6.4|31|0.5|3|Zehe|
Lauch|31|2.2|3.3|0.3|100|Portion|porree
Kartoffeln (roh)|76|2|15.5|0.1|200|Portion|kartoffel
Kartoffeln (gekocht)|73|1.9|15.4|0.1|200|Portion|salzkartoffeln pellkartoffeln kartoffel
Süßkartoffel|86|1.6|17.1|0.1|200|Portion|süsskartoffel
Kürbis (Hokkaido)|63|1.7|12.6|0.6|200|Portion|
Butternut-Kürbis|45|1|9.7|0.1|200|Portion|kürbis
Champignons|22|3.1|2.3|0.3|100|Portion|pilze
Eisbergsalat|14|0.9|1.8|0.1|80|Portion|salat
Kopfsalat|13|1.4|1.1|0.2|80|Portion|salat blattsalat
Rucola|25|2.6|2.1|0.7|40|Portion|rauke
Feldsalat|14|1.8|0.7|0.4|50|Portion|
Gemischter Salat (ohne Dressing)|20|1.2|2.6|0.3|150|Portion|beilagensalat salat
Weißkohl|25|1.3|3.3|0.1|150|Portion|weißkraut kohl
Rotkohl|31|1.4|5.3|0.2|150|Portion|blaukraut rotkraut
Rosenkohl|43|3.4|5.2|0.3|150|Portion|
Grünkohl|37|4.3|2.5|0.9|150|Portion|
Chinakohl|16|1.2|2|0.2|100|Portion|
Pak Choi|13|1.5|1.2|0.2|100|Portion|
Kohlrabi|27|1.7|3.7|0.1|150|Portion|
Spargel|20|2.2|1.8|0.1|200|Portion|
Erbsen|81|5.4|9|0.4|100|Portion|grüne erbsen
Grüne Bohnen|31|1.8|4.3|0.2|150|Portion|bohnen buschbohnen
Mais (Dose)|80|2.9|13|1.2|140|Dose|gemüsemais
Staudensellerie|16|0.7|1.4|0.2|100|Portion|sellerie
Radieschen|16|0.7|1.8|0.1|50|Portion|
Rote Bete (gekocht)|44|1.7|8|0.2|100|Portion|rote beete
Fenchel|31|1.2|4.2|0.2|150|Portion|
Ingwer|80|1.8|15.8|0.8|10|Stück|
Sauerkraut|19|0.9|1.4|0.1|150|Portion|
Gewürzgurken|16|0.5|2.5|0.2|40|Stück|essiggurken saure gurken cornichons
Edamame (ohne Schale)|121|11.9|3.7|5.2|100|Portion|sojabohnen
Gemüsemischung (TK)|38|2.2|4.8|0.5|200|Portion|tiefkühlgemüse kaisergemüse
Tomaten (Dose, gehackt)|22|1.2|3.5|0.2|400|Dose|gehackte tomaten dosentomaten pizzatomaten
Passierte Tomaten|30|1.4|5|0.3|100|Portion|passata
Tomatenmark|97|4.6|16|0.5|15|EL|

# Hülsenfrüchte, Soja
Linsen (getrocknet)|310|24|42|1.5|60|Portion|tellerlinsen berglinsen
Rote Linsen (getrocknet)|340|26|50|1.8|60|Portion|
Linsen (gekocht)|112|9|14.5|0.4|150|Portion|
Kichererbsen (Dose)|120|7|15.5|2.4|120|Portion|
Kichererbsen (getrocknet)|340|19|44|6|60|Portion|
Kidneybohnen (Dose)|105|7.5|13.5|0.6|125|Portion|rote bohnen bohnen
Weiße Bohnen (Dose)|92|6.5|12|0.5|125|Portion|bohnen
Schwarze Bohnen (Dose)|105|7|13|0.5|125|Portion|bohnen
Tofu (natur)|130|14|1.5|8|100|Portion|
Räuchertofu|175|18|2|10.5|100|Portion|tofu
Tempeh|190|19|7|10|100|Portion|
Seitan|135|26|4|1.8|100|Portion|
Sojaschnetzel (trocken)|335|50|20|1.5|40|Portion|sojagranulat sojahack
Hummus|260|7.5|10.5|19.5|30|EL|
Falafel|250|9|23|12.5|25|Stück|

# Getreide, Nudeln, Reis
Reis (roh)|352|7.5|77.5|0.7|70|Portion|basmati langkornreis jasminreis
Reis (gekocht)|130|2.7|28|0.3|180|Portion|basmati
Vollkornreis (roh)|353|7.7|73.5|2.6|70|Portion|naturreis
Vollkornreis (gekocht)|120|2.6|24|0.9|180|Portion|naturreis
Milchreis (fertig)|112|3.4|17.5|3|200|Becher|
Nudeln (roh)|355|12.5|71|1.7|100|Portion|pasta spaghetti penne fusilli makkaroni
Nudeln (gekocht)|155|5.5|30|0.9|200|Portion|pasta spaghetti penne
Vollkornnudeln (roh)|345|13.5|63|2.5|100|Portion|vollkornpasta
Vollkornnudeln (gekocht)|140|5.5|26|1.1|200|Portion|vollkornpasta
Spätzle (frisch)|165|6|28|2.6|200|Portion|eiernudeln
Gnocchi|160|3.8|34|0.5|200|Portion|
Tortellini (frisch)|290|11.5|43|7.5|125|Portion|
Maultaschen|205|8.8|23|8|60|Stück|
Couscous (roh)|358|12.5|71|1.8|60|Portion|
Couscous (zubereitet)|112|3.8|21.8|0.2|150|Portion|
Bulgur (roh)|350|12|69|1.5|60|Portion|
Bulgur (gekocht)|83|3.1|14.1|0.2|150|Portion|
Quinoa (roh)|362|13.5|60|5.8|60|Portion|
Quinoa (gekocht)|120|4.4|18.5|1.9|150|Portion|
Hirse (roh)|363|10.6|69|3.9|60|Portion|
Buchweizen|345|11|68|2.4|60|Portion|
Polenta (Maisgrieß, roh)|355|8|76.5|1.2|60|Portion|
Grieß|352|10.8|72.5|1|40|Portion|weichweizengrieß
Haferflocken|372|13.5|58.7|7|50|Portion|hafer oats
Porridge (mit Milch)|101|5.1|13.9|2.4|300|Portion|haferbrei oatmeal
Müsli (ungesüßt)|360|10.5|60|7|60|Portion|früchtemüsli
Knuspermüsli|455|8.5|63|17|60|Portion|crunchy granola
Cornflakes|378|7|84|0.9|30|Portion|
Weizenmehl (Type 405)|348|10|72.3|1|100|Portion|mehl
Weizenvollkornmehl|342|12.5|62|2.3|100|Portion|vollkornmehl mehl
Dinkelmehl (Type 630)|350|12.5|69.5|1.5|100|Portion|mehl
Speisestärke|348|0.3|86|0.1|10|EL|maisstärke stärke
Paniermehl|365|11.5|73|2|20|EL|semmelbrösel
Blätterteig|385|5.5|34.5|25|100|Portion|

# Brot und Backwaren
Toastbrot|262|8|48|3.8|25|Scheibe|toast weißer toast
Vollkorntoast|245|9.5|39.5|4|28|Scheibe|toast
Weißbrot|245|7.8|48.5|1.4|40|Scheibe|brot
Mischbrot|225|6.8|44.5|1.1|45|Scheibe|graubrot bauernbrot brot
Roggenbrot|217|6.2|43.5|1|45|Scheibe|brot
Vollkornbrot|205|7|38|1.3|50|Scheibe|roggenvollkornbrot brot
Körnerbrot|255|9.5|38|6|50|Scheibe|mehrkornbrot saatenbrot brot
Eiweißbrot|262|24|7.5|12.5|50|Scheibe|proteinbrot brot
Pumpernickel|193|5.5|36.5|1|40|Scheibe|brot
Knäckebrot|335|9.5|62.5|1.7|12|Scheibe|
Brötchen|272|8.7|54|1.6|60|Stück|semmel schrippe weck weizenbrötchen
Vollkornbrötchen|235|9|40.5|2.5|70|Stück|brötchen
Laugenbrezel|300|8.8|57|3.6|85|Stück|brezel breze laugengebäck
Baguette|262|8.8|52.5|1.4|60|Portion|
Ciabatta|262|8.8|49|3.5|60|Portion|
Fladenbrot|255|8.3|50.5|1.8|100|Portion|pide pita
Tortilla-Wrap|305|8.2|50|7.2|62|Stück|wrap tortilla weizentortilla
Bagel|260|10|50.5|1.7|85|Stück|
Croissant|406|7.5|44|22|60|Stück|
Zwieback|395|10.5|74|5|10|Stück|
Reiswaffeln|385|8|81|2.8|8|Stück|reiswaffel
Belegtes Brötchen|255|11.5|29|10|130|Stück|sandwich käsebrötchen schinkenbrötchen
Sandwich (Schinken-Käse-Toast)|265|13|26|12|150|Stück|toast

# Fleisch und Geflügel
Hähnchenbrust (roh)|106|23.5|0|1.3|150|Portion|hähnchenbrustfilet hühnerbrust hähnchen chicken geflügel poulet
Hähnchenbrust (gebraten)|165|31|0|3.6|130|Portion|hähnchenbrustfilet hühnerbrust hähnchen chicken
Hähnchenschenkel (mit Haut)|185|18|0|12.5|150|Stück|hähnchenkeule hähnchen
Brathähnchen (mit Haut)|215|24|0|13|300|Portion|grillhähnchen halbes hähnchen broiler
Putenbrust (roh)|107|24|0|1.2|150|Portion|pute truthahn putenschnitzel
Putenhackfleisch|150|19.5|0|8|125|Portion|putenhack
Rinderhackfleisch|240|19|0|18|125|Portion|rinderhack hackfleisch gehacktes
Rindertatar (mager)|125|21|0|4.5|125|Portion|tatar beefsteakhack hackfleisch
Hackfleisch (gemischt)|260|18|0|21|125|Portion|gemischtes hack gehacktes
Schweinehackfleisch|270|17|0|22.5|125|Portion|mett schweinemett hackepeter
Rindersteak (Hüfte)|121|22|0|3.7|200|Stück|hüftsteak rindfleisch steak
Rumpsteak|160|21.5|0|8.3|200|Stück|roastbeef steak rindfleisch
Rinderfilet|120|21.5|0|4|180|Stück|rindfleisch steak
Rindergulasch (roh)|135|21|0|5.5|150|Portion|gulaschfleisch rindfleisch
Schweinefilet|108|22|0|2.2|150|Portion|schweinelende schweinefleisch
Schweineschnitzel (natur)|108|22|0|2.2|150|Stück|schweinefleisch
Schweinekotelett|165|20.5|0|9.2|180|Stück|
Schweinenacken|215|18|0|16|180|Stück|nackensteak
Schweinebauch|265|17.5|0|21.5|150|Portion|bauchfleisch
Lamm (Keule)|195|19|0|13|150|Portion|lammfleisch
Kalbsschnitzel|105|21.5|0|2|150|Stück|kalbfleisch
Entenbrust (mit Haut)|215|18.5|0|15.5|150|Portion|ente
Schnitzel (paniert)|240|19|11.5|13|180|Stück|wiener schnitzel
Frikadelle|240|15|7.5|16.5|100|Stück|bulette fleischpflanzerl fleischküchle
Chicken Nuggets|250|14.5|17|13.5|18|Stück|hähnchennuggets
Bacon|315|15|0.5|28|15|Scheibe|frühstücksspeck speck
Speckwürfel|290|16|1|25|50|Portion|schinkenwürfel
Kochschinken|110|19.5|1|3|25|Scheibe|schinken hinterschinken
Rohschinken|245|30|0.3|13.5|15|Scheibe|serrano parmaschinken schwarzwälder schinken
Lachsschinken|125|23|0.8|3.3|15|Scheibe|schinken
Salami|370|22|1|31|8|Scheibe|
Putenbrust-Aufschnitt|105|21|1|1.8|15|Scheibe|geflügelaufschnitt putenaufschnitt
Fleischwurst|275|12|1|25|15|Scheibe|lyoner
Wiener Würstchen|280|13|1|25|50|Stück|wiener frankfurter bockwurst würstchen
Bratwurst|295|13.5|0.8|26.5|100|Stück|rostbratwurst
Geflügelwürstchen|215|13.5|1|17.5|50|Stück|würstchen
Leberwurst|320|13.5|1.5|29|30|Portion|
Leberkäse|295|12|1.5|27|120|Scheibe|fleischkäse
Beef Jerky|270|45|14|4|25|Portion|trockenfleisch

# Fisch
Lachs (roh)|202|20|0|13.5|125|Portion|lachsfilet
Räucherlachs|180|21.5|0|10.5|25|Scheibe|lachs
Thunfisch (Dose, im eigenen Saft)|108|24.5|0|1|130|Dose|tunfisch thunfisch natur
Thunfisch (Dose, in Öl)|190|25|0|10|130|Dose|tunfisch
Thunfischsteak|120|24|0|2.5|150|Portion|thunfisch frisch
Kabeljau|80|17.8|0|0.7|150|Portion|dorsch
Seelachs|76|17|0|0.8|150|Portion|alaska-seelachs
Forelle|115|19.8|0|3.8|150|Portion|
Pangasius|80|14.5|0|2.4|150|Portion|
Matjes|250|15.5|0.5|21|80|Stück|hering
Makrele (geräuchert)|290|20.5|0|23|100|Portion|
Sardinen (Dose, in Öl)|210|24|0|12.5|90|Dose|
Garnelen|90|19|0.5|1.2|100|Portion|shrimps krabben scampi
Fischstäbchen|200|12.5|17.5|8.5|30|Stück|
Schlemmerfilet|170|12|7.5|10.2|190|Portion|bordelaise

# Eier und Milchprodukte
Ei|143|12.6|0.7|9.9|55|Stück|eier hühnerei gekochtes ei
Eiklar|50|10.9|0.7|0.2|33|Stück|eiweiß flüssig
Eigelb|335|16|1|29.5|19|Stück|eidotter
Rührei|160|10.5|1.5|12.5|120|Portion|
Spiegelei|190|13.5|0.8|14.5|60|Stück|
Omelett|165|10.8|0.8|13|150|Portion|omelette
Milch (3,5 % Fett)|64|3.3|4.8|3.5|200|Glas|vollmilch kuhmilch|ml
Milch (1,5 % Fett)|47|3.4|4.9|1.5|200|Glas|fettarme milch kuhmilch|ml
Milch (0,3 % Fett)|35|3.5|5|0.3|200|Glas|magermilch|ml
Haferdrink|44|0.6|6.8|1.4|200|Glas|hafermilch|ml
Mandeldrink (ungesüßt)|15|0.5|0.2|1.2|200|Glas|mandelmilch|ml
Sojadrink (ungesüßt)|36|3.5|0.6|2|200|Glas|sojamilch|ml
Kokosmilch|185|1.8|2.7|18.5|100|Portion||ml
Buttermilch|37|3.4|4|0.6|250|Glas||ml
Kefir|64|3.3|4.2|3.5|250|Glas||ml
Naturjoghurt (3,5 % Fett)|66|3.8|4.6|3.6|150|Becher|joghurt natur
Naturjoghurt (1,5 % Fett)|50|4.3|5|1.5|150|Becher|joghurt fettarm
Naturjoghurt (0,1 % Fett)|39|4.8|4.8|0.1|150|Becher|magerjoghurt joghurt
Griechischer Joghurt (10 % Fett)|122|4.5|3.7|10|150|Portion|joghurt griechische art sahnejoghurt
Griechischer Joghurt (0,2 % Fett)|55|10|3.5|0.2|150|Portion|joghurt
Fruchtjoghurt|97|3.4|14.5|2.9|150|Becher|joghurt
Protein-Joghurt|60|9.5|4|0.4|200|Becher|high protein joghurt
Skyr|63|11|4|0.2|150|Portion|
Magerquark|67|12.3|4.1|0.2|250|Becher|quark speisequark topfen
Speisequark (20 % Fett)|105|11.5|3.4|4.7|250|Becher|quark halbfettquark
Speisequark (40 % Fett)|148|9.8|3.1|10.8|250|Becher|quark sahnequark
Hüttenkäse|95|12.3|2.5|4.2|200|Becher|körniger frischkäse cottage cheese
Frischkäse (Doppelrahm)|240|5.5|3.8|22.5|30|Portion|philadelphia
Frischkäse (leicht)|150|7.8|5|11|30|Portion|
Schmand|240|2.6|3.2|24|30|EL|
Saure Sahne|117|3.1|4|10|30|EL|sauerrahm
Crème fraîche|292|2.4|2.6|30|30|EL|creme fraiche
Schlagsahne|292|2.4|3.2|30|30|EL|sahne|ml
Kochsahne (15 % Fett)|165|3|4.2|15|30|EL|sahne|ml
Kondensmilch (7,5 % Fett)|133|6.5|9.7|7.5|10|TL|kaffeemilch|ml
Butter|745|0.7|0.6|82.5|10|Portion|
Kräuterbutter|630|1|1.5|68.5|10|Portion|
Margarine|720|0.2|0.3|80|10|Portion|
Halbfettmargarine|360|0.3|0.5|39.5|10|Portion|
Gouda|356|24|0.1|29|25|Scheibe|käse schnittkäse
Edamer|320|25|0.1|24.5|25|Scheibe|käse
Emmentaler|385|28|0.1|30|25|Scheibe|käse
Cheddar|410|25|0.5|34|25|Scheibe|käse
Bergkäse|410|28|0.1|33|30|Portion|käse
Reibekäse|365|25|0.5|29|25|Portion|streukäse geriebener käse pizzakäse
Schmelzkäse-Scheibe|270|14|6|21|20|Scheibe|toastkäse scheibletten
Mozzarella|245|18|1.5|18.5|125|Kugel|käse
Mozzarella (light)|165|19.5|1.2|8.8|125|Kugel|käse
Feta|280|17|0.7|23|50|Portion|schafskäse hirtenkäse
Halloumi|320|22|2|25|100|Portion|grillkäse
Parmesan|398|33|0|29.5|10|EL|parmigiano grana padano hartkäse
Camembert|290|20|0.3|23|30|Portion|käse
Brie|350|17.5|0.5|31|30|Portion|käse
Harzer Käse|120|28.5|0|0.6|100|Portion|handkäse
Ricotta|150|9|3.5|11|50|Portion|
Mascarpone|400|4.5|3.5|41|30|EL|
Pudding (Vanille)|105|3|16.5|2.9|150|Becher|vanillepudding schokopudding
Protein-Pudding|78|10|5.5|1.5|200|Becher|high protein pudding
Grießbrei|115|3.8|17|3.4|250|Portion|griesbrei

# Fette und Öle
Olivenöl|900|0|0|100|10|EL|öl
Rapsöl|900|0|0|100|10|EL|öl
Sonnenblumenöl|900|0|0|100|10|EL|öl
Kokosöl|900|0|0|100|10|EL|kokosfett
Leinöl|900|0|0|100|10|EL|öl
Butterschmalz|897|0.1|0|99.7|10|EL|ghee
Mayonnaise|720|1.1|2|79|15|EL|mayo
Salatmayonnaise|485|0.8|6|51|15|EL|mayo salatcreme

# Nüsse und Samen
Mandeln|590|21|7.5|51|25|Handvoll|
Walnüsse|675|15|7|65.5|25|Handvoll|walnusskerne
Haselnüsse|645|14|7|61.5|25|Handvoll|
Cashewkerne|580|18|27|44|25|Handvoll|cashews cashewnüsse
Erdnüsse (geröstet, gesalzen)|610|25.5|9.5|50|25|Handvoll|erdnusskerne
Pistazien|595|21|14|48|25|Handvoll|
Paranüsse|680|14|4|67|15|Portion|
Pekannüsse|700|9|4.5|72|25|Handvoll|
Macadamia|725|8|5|75.5|25|Handvoll|
Pinienkerne|690|14|9|68.5|10|EL|
Studentenfutter|480|12.5|40|30|30|Handvoll|nussmischung
Erdnussbutter|615|25|11|50|15|EL|erdnussmus peanut butter erdnusscreme
Mandelmus|640|23|6|55.5|15|EL|
Tahin|645|22|5|57|15|EL|sesammus sesampaste tahini
Sonnenblumenkerne|600|22|10|51|10|EL|
Kürbiskerne|590|31|4.5|49|10|EL|
Leinsamen|515|20|1.5|40|10|EL|
Chiasamen|460|20|4.5|31.5|10|EL|chia
Sesam|598|18.5|10|52|10|EL|

# Süßes und Snacks
Zucker|400|0|100|0|5|TL|kristallzucker rohrzucker puderzucker
Honig|320|0.4|80|0|20|EL|
Ahornsirup|265|0|66.5|0|15|EL|
Agavendicksaft|305|0|75|0|15|EL|
Marmelade|250|0.4|60|0.1|20|Portion|konfitüre gelee
Nuss-Nougat-Creme|539|6.3|57.5|30.9|15|Portion|nutella schokocreme haselnusscreme
Vollmilchschokolade|535|6.5|58|30|25|Portion|schokolade
Zartbitterschokolade (70 %)|570|8.5|33|42|25|Portion|dunkle schokolade bitterschokolade
Weiße Schokolade|560|7|58|33|25|Portion|schokolade
Schokoriegel|484|8.6|58|23.5|50|Riegel|snickers mars twix
Gummibärchen|343|6.9|77|0.5|25|Handvoll|fruchtgummi weingummi
Butterkeks|440|8|73|12.5|5|Stück|kekse
Schokokekse|495|6|62|24.5|12|Stück|cookies kekse
Kartoffelchips|535|6|50|34|30|Handvoll|chips paprikachips
Salzstangen|390|10.5|74|5|25|Handvoll|salzbrezeln
Erdnussflips|505|13|50|27.5|25|Handvoll|flips
Popcorn (süß)|420|6|70|11.5|30|Portion|
Müsliriegel|415|6.5|63|14|25|Riegel|
Proteinriegel|370|32|30|12.5|50|Riegel|eiweißriegel protein bar
Vanilleeis|205|3.5|22.5|11|50|Kugel|eis eiscreme speiseeis
Rührkuchen|410|5.8|49|21|70|Stück|marmorkuchen kuchen
Käsekuchen|270|8.5|27|14|120|Stück|kuchen
Apfelkuchen|240|3.2|33|10.5|120|Stück|kuchen
Muffin|420|5.8|50|22|100|Stück|
Donut|425|5.5|47|24|60|Stück|
Berliner|345|6|47|14.5|70|Stück|krapfen kreppel
Pfannkuchen|200|6.8|26|7.5|80|Stück|crêpe eierkuchen palatschinken
Kaiserschmarrn|220|6.5|29|8.5|250|Portion|
Kakaopulver (ungesüßt)|390|21|10|21|5|TL|backkakao
Kakao-Getränkepulver|380|5|79|3.2|15|Portion|trinkschokoladenpulver

# Getränke
Wasser|0|0|0|0|250|Glas|mineralwasser sprudel|ml
Kaffee (schwarz)|2|0.1|0.3|0|200|Tasse|espresso filterkaffee|ml
Cappuccino|40|2.2|3.2|2.2|200|Tasse|kaffee|ml
Latte Macchiato|52|2.8|4|2.9|300|Glas|milchkaffee|ml
Tee (ungesüßt)|1|0|0.2|0|250|Tasse|kräutertee grüner tee schwarztee|ml
Kakao (Trinkschokolade)|78|3.4|10.5|2.4|250|Glas|schokomilch heiße schokolade|ml
Cola|42|0|10.6|0|330|Dose|limonade|ml
Cola Zero|0|0|0|0|330|Dose|cola light zuckerfrei|ml
Limonade|38|0|9.2|0|330|Dose|orangenlimonade zitronenlimonade|ml
Apfelsaft|46|0.1|11|0.1|200|Glas|saft|ml
Apfelschorle|25|0.1|5.9|0|250|Glas|saftschorle|ml
Orangensaft|44|0.7|9.3|0.2|200|Glas|saft o-saft|ml
Multivitaminsaft|48|0.4|11|0.1|200|Glas|saft|ml
Smoothie|56|0.6|12.5|0.2|250|Flasche||ml
Energy Drink|46|0|11|0|250|Dose|energydrink|ml
Energy Drink (zuckerfrei)|3|0|0|0|250|Dose|energydrink|ml
Eistee|27|0|6.5|0|250|Glas||ml
Isotonisches Getränk|24|0|5.8|0|500|Flasche|isodrink sportgetränk|ml
Protein-Drink|60|8.5|3.8|1|330|Flasche|proteindrink eiweißdrink proteinshake|ml
Bier (Pils)|42|0.5|3|0|500|Flasche|pils helles|ml
Weizenbier|47|0.5|3.5|0|500|Flasche|hefeweizen weißbier|ml
Alkoholfreies Bier|25|0.4|5.3|0|500|Flasche|bier alkoholfrei|ml
Radler|40|0.3|6.2|0|500|Flasche|alsterwasser|ml
Rotwein|80|0.1|0.5|0|150|Glas|wein|ml
Weißwein|75|0.1|1|0|150|Glas|wein|ml
Sekt|80|0.2|2.5|0|100|Glas|prosecco champagner|ml
Schnaps (40 %)|225|0|0|0|20|Glas|wodka vodka gin rum whisky korn|ml

# Gerichte
Pizza Margherita|240|10|29|9|350|Stück|pizza tiefkühlpizza
Pizza Salami|258|10.5|28|11.3|330|Stück|pizza tiefkühlpizza
Döner Kebab|205|10.5|18.5|9.5|350|Stück|döner kebab
Hamburger|253|12.5|30|9|105|Stück|burger
Cheeseburger|255|13.4|26|11|120|Stück|burger
Hot Dog|250|9.5|22|13.5|130|Stück|
Currywurst|235|9.5|8|18.5|200|Portion|
Pommes frites (frittiert)|300|3.5|37|14.5|150|Portion|pommes fritten
Pommes frites (Backofen)|215|3.2|32|7.5|150|Portion|pommes backofenpommes
Bratkartoffeln|165|2.5|19|8|250|Portion|
Kartoffelpüree|100|2|14.5|3.5|200|Portion|kartoffelbrei stampfkartoffeln
Kartoffelsalat (mit Mayonnaise)|175|1.8|14|12|200|Portion|
Kartoffelsalat (Essig-Öl)|105|1.6|14|4.5|200|Portion|
Kartoffelgratin|145|4|12|9|250|Portion|
Kartoffelpuffer|215|2.5|23|12|60|Stück|reibekuchen
Kartoffelknödel|125|2.8|27|0.5|90|Stück|klöße knödel
Semmelknödel|185|6.5|30|4|100|Stück|knödel
Lasagne|145|7.5|12.5|7|400|Portion|lasagne bolognese
Spaghetti Bolognese|140|6.8|17|4.6|400|Portion|nudeln bolognese
Spaghetti Carbonara|190|7.8|20|8.6|400|Portion|nudeln carbonara
Nudeln mit Tomatensauce|120|4|21|2|400|Portion|pasta napoli
Nudelsalat|205|4.5|20|11.5|200|Portion|
Ravioli (Dose)|88|3.2|13.5|2.2|400|Portion|
Chili con Carne|115|8|8|5|400|Portion|
Gulasch|125|13|3.5|6.5|300|Portion|rindergulasch
Hähnchen-Curry mit Reis|140|7.5|16.5|4.6|400|Portion|curry
Reis mit Hähnchen und Gemüse|128|9.5|15|3|450|Portion|
Gebratener Reis mit Gemüse|160|3.8|25|4.8|350|Portion|bratreis
Sushi|150|5.5|27.5|2|25|Stück|maki nigiri
Wrap (Hähnchen)|205|11|21|8|250|Stück|
Frühlingsrolle|220|5|26|10.5|50|Stück|
Fischbrötchen|235|10.5|24|10.5|150|Stück|
Caesar Salad (mit Hähnchen)|135|9|5.5|8.5|300|Portion|salat
Linsensuppe|85|5.5|10|2|400|Portion|eintopf
Kartoffelsuppe|65|1.8|8|2.8|400|Portion|
Tomatensuppe|45|1|6.5|1.6|400|Portion|
Hühnersuppe|42|3.2|3.8|1.4|400|Portion|nudelsuppe hühnerbrühe
Gemüsesuppe|38|1.5|5.2|1|400|Portion|minestrone

# Saucen und Würzen
Ketchup|102|1.2|23.2|0.1|15|EL|tomatenketchup
Senf|95|6|5.5|4.5|5|TL|
Sojasauce|70|10|3.5|0|15|EL||ml
BBQ-Sauce|150|1|35|0.4|15|EL|barbecue grillsauce
Sweet-Chili-Sauce|205|0.5|50|0.3|15|EL|chilisauce
Pesto (Basilikum)|450|4.5|5.5|45|20|EL|pesto verde
Tomatensauce|58|1.5|7.5|2.2|200|Portion|pastasauce nudelsauce
Bolognese-Sauce|95|5.5|6.5|5|200|Portion|
Tzatziki|130|3.8|4.2|10.8|50|Portion|zaziki
Guacamole|160|1.8|4|14.5|30|EL|
Dressing (Vinaigrette)|290|0.3|5|29.5|20|EL|salatdressing essig öl
Dressing (Joghurt)|145|1.5|8|12|30|Portion|salatdressing joghurtdressing
Balsamico-Essig|95|0.5|19|0|10|EL|essig balsamessig|ml
Gemüsebrühe|5|0.2|0.5|0.2|250|Tasse|brühe bouillon|ml

# Sportnahrung
Proteinpulver (Whey)|385|76|6.5|6|30|Portion|whey eiweißpulver
Proteinpulver (vegan)|380|72|5|6.5|30|Portion|eiweißpulver erbsenprotein
Maltodextrin|384|0|96|0|30|Portion|
Dextrose|368|0|92|0|10|Portion|traubenzucker
`;

/** Für die Suche vereinheitlichen: Kleinbuchstaben, Umlaute und Akzente falten
    (ä = ae = a, ß = ss), damit „Hähnchen“, „Haehnchen“ und „Hahnchen“ dasselbe finden. */
function foldText(s) {
  return String(s || '').toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9%]+/g, ' ').trim();
}

const FOOD_DB = [];
(() => {
  let dish = false;
  for (const raw of FOOD_DB_RAW.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { dish = line === '# Gerichte'; continue; }
    const [name, kcal, p, c, f, serving, label, words, unit] = line.split('|');
    const folded = foldText(name);
    FOOD_DB.push({
      id: 'b-' + folded.replace(/ /g, '-'),
      name,
      brand: '',
      unit: unit === 'ml' ? 'ml' : 'g',
      per100: { kcal: Number(kcal), p: Number(p), c: Number(c), f: Number(f) },
      serving: Number(serving) || null,
      servingLabel: label || '',
      src: 'builtin',
      _name: folded,
      _first: folded.split(' ')[0],
      _words: foldText(words).split(' ').filter(Boolean),
      _all: `${folded} ${foldText(words)}`,
      _dish: dish,
    });
  }
})();

/** Treffer in der eingebauten Liste – die naheliegendsten zuerst:
    1. genauer Name                      „Skyr“
    2. erstes Wort ist das Suchwort      „Milch (3,5 % Fett)“ vor „Milchreis“, „Kartoffeln“ bei „Kartoffel“
    3. gehört zur gesuchten Art          „Gouda“ bei „Käse“ (Suchwort) oder „Harzer Käse“
    4. zusammengesetztes Wort, das so endet   „Bergkäse“, „Vollkornbrot“
    5. Name beginnt so                   „Käsekuchen“
    6. Wortanfänge, irgendwo im Namen, zuletzt nur über Suchwörter
    Fertige Gerichte stehen hinter Grundnahrungsmitteln, kurze Namen vor langen. */
function builtinSearch(q, limit = 12) {
  const words = foldText(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  const full = words.join(' ');
  const single = words.length === 1;
  const forms = [full, full + 'n', full + 'e', full + 'en', full + 's'];
  const out = [];
  for (const f of FOOD_DB) {
    if (!words.every((w) => f._all.includes(w))) continue;
    const nameWords = f._name.split(' ');
    let score;
    if (f._name === full) score = 200;
    else if (forms.includes(f._first)) score = 90;
    else if (single && (f._words.includes(full) || nameWords.some((n) => forms.includes(n)))) score = 80;
    else if (single && full.length >= 3 && nameWords.some((n) => n.endsWith(full))) score = 70;
    else if (f._name.startsWith(full)) score = 50;
    else if (words.every((w) => nameWords.some((n) => n.startsWith(w)))) score = 40;
    else if (words.every((w) => f._name.includes(w))) score = 20;
    else score = 10;
    if (f._dish) score -= 25;
    score -= f._name.length * 0.1;
    out.push([score, f]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, f]) => publicFood(f));
}

/** Ohne die internen Suchfelder (für Tagebuch und Sync). */
function publicFood(f) {
  const { _name, _first, _words, _all, _dish, ...rest } = f;
  return rest;
}
