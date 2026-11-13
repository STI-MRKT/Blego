# BIO organization catalogue provenance

Checked: 2026-11-13. Catalogue: `resources/generator/institutions.json` (the existing file; no second runtime catalogue).

## Scope and semantics

- 55 records: 23 companies, 17 universities, 15 secondary schools across BR, US, FR, PL, DE, ES, IT and GB. Every country has a school, university, and at least one company compatible with each BIO category (model, tech, crypto).
- Bounded starter coverage only. Cities with no verified matching organization must stay blank; a company or institution must never acquire the generated person's city. Region names are consistent within a city. London does not alias the separate City of London municipality.
- Names and locations are factual metadata from official institutional/company websites. Stable project IDs use an `official:<country>:<slug>` namespace. `source.id` is the official URL, not a fabricated external database ID.
- `source.license` explicitly describes factual-metadata extraction and retention of original site rights. No open-content licence is asserted for official websites; no marketing paragraphs, logos, or photographs are redistributed in the catalogue.
- `roles` is project-authored, industry-compatible synthetic BIO vocabulary, not a claim of current job openings, particular employee roles, employment, or attendance. Empty category arrays prohibit incompatible assignments. The crypto category permits financial technology/digital finance as requested; a payments company receives payments/digital-finance titles, never invented blockchain-engineering titles. No company receives a model role merely because it has a marketing department.
- Names retain source spelling. City aliases are explicit ordinary equivalents (São Paulo/Sao Paulo, New York/New York City, Warszawa/Warsaw, Kraków/Krakow/Cracow, Gdańsk/Gdansk, Milan/Milano). No unrelated town is an alias. Runtime country places were inspected; the initial major-city set had no intersection with seven of the eight alphabetically bounded samples. The verified bundled-city extension below corrects that functional gap without altering the geography distribution. It is still not nationwide coverage.

## Verification method and results

The Firecrawl skill was used for official-page discovery and retrieval. Company records below were checked against returned page content, including footer/address text when the main-content extractor omitted it; HTTP 200 alone did not establish identity/location. Search snippets alone were not used as final evidence. Regional names are administrative labels, not copied descriptive text.

All 17 initial companies have successful official HTTP 200 content retrieval with identity and city evidence. Twenty-two of the 23 retained educational institutions have current successful content retrieval. Lycée Louis-le-Grand currently returns an HTTP 200 entry/splash page without location content: its same-day identity and Paris verification is retained from [INSTITUTIONS.md](../INSTITUTIONS.md), explicitly not counted as a fresh location verification. The existing 23 education rows were preserved, with stronger official contact URLs substituted where available.

The first local curl recheck attempted 23 education URLs but all 23 failed before reaching the origin (HTTP 000, local proxy connection refused). Those attempts are **not** source failures or successful checks. Connector retrieval was used afterward. FEUSP's old HTTPS hostname returned a TLS error through the connector; the official faculty page linked to the school's canonical replacement, and `https://www3.ea.fe.usp.br/` returned HTTP 200. TLS validation was not disabled.

## Company evidence

| Country | Organization | Actual city / region | Official page and observed evidence |
| --- | --- | --- | --- |
| BR | AMARO | São Paulo / São Paulo | [HTTP 200](https://amaro.com/politica-de-privacidade/). Official legal/footer address: Avenida Paulista 1471, São Paulo/SP. Clothing catalogue links establish fashion retail. |
| BR | Nubank | São Paulo / São Paulo | [HTTP 200](https://nubank.com.br/). Official footer identifies Nu Pagamentos S.A. and Rua Capote Valente 39, São Paulo/SP. The page describes its financial products. |
| US | Ralph Lauren Corporation | New York / New York | [HTTP 200](https://corporate.ralphlauren.com/contact). Corporate headquarters contact: 650 Madison Avenue, New York, NY 10022. |
| US | Gemini | New York / New York | [HTTP 200](https://support.gemini.com/hc/en-us/articles/204732835-Customer-Support). Official customer-support postal contact: 600 Third Avenue, 2nd Floor, New York, NY 10016. The same page describes cryptocurrency buying/selling. |
| FR | Christian Dior Couture | Paris / Île-de-France | [HTTP 200](https://www.dior.com/en_us/fashion/legal-terms). Official legal terms identify Christian Dior Couture, luxury retail, and Paris headquarters (also New York); redirect to en_us retained as canonical URL. |
| FR | Ledger | Paris / Île-de-France | [HTTP 200](https://www.ledger.com/legal-center). Official legal-centre footer: 106 rue du Temple, 75003 Paris. Product links identify crypto wallets/security devices. |
| PL | Agora S.A. | Warszawa / województwo mazowieckie | [HTTP 200](https://www.agora.pl/kontakt). Official contact page: Agora S.A., Czerska 8/10, 00-732 Warszawa; official site identifies its media/publishing business. |
| PL | LPP S.A. | Gdańsk / województwo pomorskie | [HTTP 200](https://www.lpp.com/en/contact/). Official headquarters contact: Łąkowa 39/44, 80-769 Gdańsk. Official homepage independently identifies the clothing business. |
| PL | XTB S.A. | Warszawa / województwo mazowieckie | [HTTP 200](https://www.xtb.com/pl/kontakt). Official contact: Prosta 67, 00-838 Warszawa. Official about page describes proprietary investment technology and IT development. |
| DE | Zalando SE | Berlin / Berlin | [HTTP 200](https://partner.zalando.com/imprint). Official imprint: Zalando SE, Valeska-Gert-Straße 5, 10243 Berlin. Official careers page describes fashion/lifestyle commerce. |
| DE | N26 SE | Berlin / Berlin | [HTTP 200](https://n26.com/en-eu/imprint). Official imprint identifies N26 SE at Voltairestraße 8, 10179 Berlin. Official about page confirms digital banking and crypto products. |
| ES | LOEWE S.A. | Madrid / Comunidad de Madrid | [HTTP 200](https://www.loewe.com/eur/en/welcome_loewe). Official terms identify LOEWE S.A. headquarters at Calle Goya 4, 28001 Madrid. |
| ES | XTB S.A., Sucursal en España | Madrid / Comunidad de Madrid | [HTTP 200](https://www.xtb.com/es/contacto). Official Spanish contact: XTB S.A., Sucursal en España; Pedro Teixeira 8, 6ª Planta, 28020 Madrid. This is the actual Spanish branch, not the Polish headquarters relocated. |
| IT | Giorgio Armani Milano | Milan / Lombardia | [HTTP 200](https://locations.armani.com/en/giorgio-armani/italy/giorgio-armani-milano). Official Giorgio Armani Milano boutique: Via Sant'Andrea 9, 20121 Milano; clothing/accessories and styling retail context. This entry deliberately names the verified boutique, not an unverified corporate headquarters. |
| IT | Nexi S.p.A. | Milan / Lombardia | [HTTP 200](https://www.nexigroup.com/en/contacts/). Official contact identifies Nexi S.p.A., Corso Sempione 55, 20149 Milan. Official pages describe payment technology. |
| GB | Burberry Group plc | London / Greater London | [HTTP 200](https://www.burberryplc.com/contacts). Official head office: Horseferry House, Horseferry Road, Westminster, London SW1P 2AW. |
| GB | Revolut Ltd | London / Greater London | [HTTP 200](https://www.revolut.com/legal/terms/). Official terms identify Revolut Ltd, app/API-based electronic-money services, and postal contact at 30 South Colonnade, London E14 5HX. |

Additional successful industry corroboration: [Zalando careers](https://jobs.zalando.com/en), [LPP](https://www.lpp.com/en/), [XTB about](https://www.xtb.com/pl/o-nas), [N26 about](https://n26.com/en-eu/about-n26), [Nexi](https://www.nexigroup.com/en/). All returned HTTP 200 and relevant content.

## Education evidence

Earlier check details and short address excerpts remain in [INSTITUTIONS.md](../INSTITUTIONS.md). The table records the current source used by each catalogue row; homepage identities without a fresh street-address excerpt retain the earlier check rather than implying a newly verified address.

| Country | Institution | Actual city / region | Official source | Current retrieval |
| --- | --- | --- | --- | --- |
| BR | Universidade de São Paulo | São Paulo / São Paulo | [Official source](https://www5.usp.br/) | HTTP 200 institution content |
| US | Columbia University | New York / New York | [Official source](https://www.columbia.edu/) | HTTP 200 institution content |
| US | Stuyvesant High School | New York / New York | [Official source](https://stuy.enschool.org/) | HTTP 200 institution content |
| FR | Sorbonne Université | Paris / Île-de-France | [Official source](https://www.sorbonne-universite.fr/) | HTTP 200 institution content |
| FR | Lycée Louis-le-Grand | Paris / Île-de-France | [Official source](https://www.louislegrand.fr/) | HTTP 200 splash only; prior same-day location evidence retained |
| PL | Uniwersytet Warszawski | Warszawa / województwo mazowieckie | [Official source](https://www.uw.edu.pl/) | HTTP 200 institution content |
| PL | XIV LO im. Stanisława Staszica | Warszawa / województwo mazowieckie | [Official source](https://staszic.waw.pl/) | HTTP 200 institution content |
| DE | John-Lennon-Gymnasium | Berlin / Berlin | [Official source](https://www.jlgym-berlin.de/) | HTTP 200 institution content |
| ES | Universidad Complutense de Madrid | Madrid / Comunidad de Madrid | [Official source](https://www.ucm.es/) | HTTP 200 institution content |
| ES | IES San Isidro | Madrid / Comunidad de Madrid | [Official source](https://site.educa.madrid.org/ies.sanisidro.madrid/) | HTTP 200 institution content |
| GB | University College London | London / Greater London | [Official source](https://www.ucl.ac.uk/) | HTTP 200 institution content |
| IT | Politecnico di Milano | Milan / Lombardia | [Official source](https://www.polimi.it/en/contacts) | HTTP 200 institution content |
| IT | Liceo Classico Cesare Beccaria | Milan / Lombardia | [Official source](https://www.liceobeccaria.edu.it/) | HTTP 200 institution content |
| BR | Escola de Aplicação da FEUSP | São Paulo / São Paulo | [Official source](https://www3.ea.fe.usp.br/) | HTTP 200 institution content |
| DE | Freie Universität Berlin | Berlin / Berlin | [Official source](https://www.fu-berlin.de/en/redaktion/impressum/index.html) | HTTP 200 institution content |
| GB | Camden School for Girls | London / Greater London | [Official source](https://www.camdengirls.camden.sch.uk/page/?title=Contact+Us&pid=147) | HTTP 200 institution content |
| BR | Universidade Federal do Rio de Janeiro | Rio de Janeiro / Rio de Janeiro | [Official source](https://ufrj.br/) | HTTP 200 institution content |
| FR | Université Paris Cité | Paris / Île-de-France | [Official source](https://u-paris.fr/) | HTTP 200 institution content |
| PL | Uniwersytet Jagielloński | Kraków / województwo małopolskie | [Official source](https://www.uj.edu.pl/) | HTTP 200 institution content |
| DE | Technische Universität Berlin | Berlin / Berlin | [Official source](https://www.tu.berlin/kontakt) | HTTP 200 institution content |
| ES | Universidad Autónoma de Madrid | Madrid / Comunidad de Madrid | [Official source](https://www.uam.es/uam/contacto) | HTTP 200 institution content |
| IT | Università di Bologna | Bologna / Emilia-Romagna | [Official source](https://www.unibo.it/) | HTTP 200 institution content |
| GB | University of Oxford | Oxford / Oxfordshire | [Official source](https://www.ox.ac.uk/about/contact-us) | HTTP 200 institution content |

Stronger address content was read from the official contact/legal pages for Camden (Sandall Road, London), Freie Universität Berlin (Kaiserswerther Str. 16–18, 14195 Berlin), TU Berlin (Straße des 17. Juni 135, 10623 Berlin), UAM (Ciudad Universitaria de Cantoblanco, Madrid), Oxford (Wellington Square, Oxford OX1 2JD), and Politecnico di Milano (Piazza Leonardo da Vinci 32, Milano). The FEUSP faculty page at [fe.usp.br](https://www.fe.usp.br/) independently links the school and provides São Paulo/SP campus context.

## Rejected candidates and incomplete pages

- Satispay was not added: the payment-provider legal identity was Satispay Europe S.A. in Luxembourg; the Milan footer address belonged to SatisWelfare S.p.A. That evidence does not justify relocating the payment provider to Milan. Nexi provides verified Milan coverage instead.
- La Mania and Bnext search results did not provide sufficient official location evidence; neither was added. Agora supplies Warsaw media coverage. Indexa pages read did not establish the desired city sufficiently; XTB's official Madrid branch does.
- Guessed Ledger legal-notice, Armani legal-information, and Burberry contact-us paths returned HTTP 404. Included entries use the successfully retrieved official URLs above.
- Initial Zalando corporate and Ralph Lauren about paths returned HTTP 200 without useful extracted address text. Official imprint/contact pages above supply the address evidence.
- Chanel's guessed legal path returned the retail homepage without sufficient Paris corporate-address evidence. Christian Dior Couture's actual legal terms supply Paris coverage.
- Guessed Camden contact-us and about/contact, Freie Universität presidency, Oxford university-offices, and FEUSP escola-de-aplicacao paths returned HTTP 404. Correct official linked pages were retrieved where used.
- Lycée Louis-le-Grand root/contact alternatives returned the same entry page; no claim is made that those current responses independently verified Paris.

## UK administrative-area precision

London records use **Greater London**; Oxford uses **Oxfordshire**. The broad constituent-country label England is deliberately not used as a shared fallback region. [Greater London Authority / London City Hall](https://www.london.gov.uk/who-we-are) returned HTTP 200 and identifies the Greater London Authority. [Oxfordshire County Council's district-councils page](https://www.oxfordshire.gov.uk/council/about-your-council/government-oxfordshire/district-councils) returned HTTP 200 and explicitly lists Oxford City Council among its districts. These two administrative labels keep Oxford education from becoming a fallback for London companies.

The final government-page retrieval exhausted the connected Firecrawl credit allowance before running three requested follow-up scrapes. Public government pages were then read with curl (TLS verified; redirects; 20-second deadline; 4 MB limit) outside the network-restricted sandbox. Oxfordshire's district-councils page and the London Assembly page both returned HTTP 200. The guessed earlier Oxfordshire path returned HTTP 404 and was not used. The credit failure does not change the completed company/education checks above.

## Structural checks

The catalogue parses as one JSON array; IDs are unique; required fields and HTTPS official URLs are present; company roles contain exactly model/tech/crypto arrays; each country has all three organization kinds and all three compatible company categories. Organization city/region values are internally consistent. This is data validation, not an assertion of nationwide source coverage.

## Bundled-city coverage extension

The initial catalogue supplied verified major-city records, but the runtime's first-500 country place samples omitted those cities in BR/US/FR/PL/DE/ES/IT. Fifteen additional records now establish one source-backed sampled locality in each country. No generator geography file was changed. All selected city/postal pairs were checked against the actual bundled `countries/*.json` records.

| Country | Bundled city / postcode | Local secondary school | University choice | Model / crypto company choices | Administrative region |
| --- | --- | --- | --- | --- | --- |
| BR | Adamantina / 17800-000 | Etec Engenheiro Herval Bellusci | Universidade de São Paulo (São Paulo) | AMARO / Nubank (São Paulo) | São Paulo |
| US | Amsterdam / 12010 | Amsterdam High School | Columbia University (New York) | Ralph Lauren / Gemini (New York) | New York |
| FR | Alfortville / 94140 | Lycée Maximilien Perret | Sorbonne Université (Paris) | Christian Dior Couture / Ledger (Paris) | Île-de-France |
| PL | Andrychów / 34-120 | I Liceum Ogólnokształcące | Uniwersytet Jagielloński (Kraków) | LPP Kraków branch / Ailleron (Kraków) | województwo małopolskie |
| DE | Aachen / 52062 | Couven Gymnasium Aachen | RWTH Aachen University (Aachen) | ARMEDANGELS (Köln) / auxmoney (Düsseldorf) | Nordrhein-Westfalen |
| ES | A Coruña / 15001 | IES Salvador de Madariaga | Universidade da Coruña (A Coruña) | Inditex (Arteixo) / Inversa (Ferrol) | Galicia |
| IT | Abbiategrasso / 20081 | Istituto d'Istruzione Superiore Bachelet | Politecnico di Milano (Milan) | Giorgio Armani Milano / Nexi (Milan) | Lombardia |
| GB | London / EC1A 1BB | Camden School for Girls | University College London | Burberry / Revolut | Greater London |

Parentheses identify the organization’s **actual** city; regional fallback must keep that city visible. Same administrative region does not mean the same town, adjacent town, commuting distance, or a claim that the generated person attended/worked there. The school establishes a verified local region; unknown towns still cannot acquire a region by broad country-level fallback.

### New records and content checks

Thirteen additions were supported by fresh official curl HTTP 200 page content. Amsterdam High School and Inditex were read successfully from their official pages through the web reader after curl returned HTTP 406 and 403 respectively; the failing curl responses were not counted as verification. Curl used TLS verification, redirects, compressed-response decoding, a 25-second deadline and a 4 MB cap per URL. No authentication or TLS bypass was used.

| Record | Official source | Observed factual evidence |
| --- | --- | --- |
| Etec Engenheiro Herval Bellusci — Adamantina | [Official source](https://www.cps.sp.gov.br/etecs/etec-eng-herval-bellusci/) | Centro Paula Souza names the school and provides Adamantina/SP, CEP 17800-000; its offerings explicitly include integrated ensino médio. |
| Amsterdam High School — Amsterdam | [Official source](https://www.gasd.org/o/ahs/page/about-our-school/) | Official school page: 140 Saratoga Avenue, Amsterdam, NY 12010. Web reader returned full school-page content; curl HTTP 406. |
| Lycée Maximilien Perret — Alfortville | [Official source](https://lycee-maximilienperret.fr/) | Official school footer: Place San Benedetto del Tronto, 94140 Alfortville. Onisep's government education entry independently names the lycée. |
| I Liceum Ogólnokształcące im. Marii Skłodowskiej-Curie w Andrychowie — Andrychów | [Official source](https://liceum-andrychow.edu.pl/sekretariat/) | School secretariat: Ferdynanda Pachla 16, 34-120 Andrychów. Official homepage provides the full I Liceum / Marii Skłodowskiej-Curie name. |
| LPP S.A. — Kraków | [Official source](https://www.lpp.com/en/contact/) | Official corporate contact lists its Cracow branch at Bagrowa 7, 30-733 Cracow; this is a separate verified site of LPP, not a renamed headquarters. |
| Ailleron S.A. — Kraków | [Official source](https://ailleron.com/terms-of-service/) | Official terms name Ailleron S.A., Jana Pawła II 43b, 31-864 Kraków, and technology services for fintechs/banks. |
| Couven Gymnasium Aachen — Aachen | [Official source](https://www.couven-gymnasium.de/wordpress2/ansprechpartner/schulleitungsteam/) | School contact page: Couven Gymnasium Aachen, Lütticher Str. 111a, 52074 Aachen. |
| RWTH Aachen University — Aachen | [Official source](https://www.rwth-aachen.de/cms/root/Footer/Services/~bw/Impressum/lidx/1/) | Official legal notice: RWTH Aachen University, Templergraben 55, 52062 Aachen. |
| Social Fashion Company GmbH (ARMEDANGELS) — Köln | [Official source](https://www.armedangels.com/de-at/pages/impressum) | Official imprint: Social Fashion Company GmbH, Thebäerstr. 17, 50823 Köln; fashion retail site. |
| auxmoney GmbH — Düsseldorf | [Official source](https://www.auxmoney.com/impressum) | Official imprint: auxmoney GmbH, Kasernenstraße 67, D-40213 Düsseldorf; official homepage corroborates online lending. |
| Universidade da Coruña — A Coruña | [Official source](https://www.udc.es/) | Official university homepage: Universidade da Coruña, Rúa da Maestranza 9, 15001 A Coruña. |
| IES Salvador de Madariaga — A Coruña | [Official source](https://dirof.xunta.gal/diroficial/v2/unidades/A12X03291) | Xunta's official directory identifies school code 15005211, IES Salvador de Madariaga, Paseo de Ronda 49, A Coruña, and Galicia. The city education directory independently lists ESO and Bachillerato. |
| Inditex — Arteixo | [Official source](https://www.inditex.com/itxcomweb/nf/es/informacion/contacto) | Official contact page: Inditex headquarters, Avenida de la Diputación s/n, 15143 Arteixo, A Coruña. Web reader returned full content; curl HTTP 403. Arteixo is the city, not A Coruña city. |
| Galaicus Fintech S.L. (Inversa) — Ferrol | [Official source](https://www.inversa.es/en/contracts-and-rates/) | Official contracts and legal notice name Galaicus Fintech S.L. (INVERSA), Estrella 4, 15401 Ferrol, and its online invoice-financing platform. |
| Istituto d'Istruzione Superiore Bachelet — Abbiategrasso | [Official source](https://iisbachelet.edu.it/dove-siamo) | Official school directions: Via Stignani 63, 20081 Abbiategrasso (MI). School offers liceo/secondary programmes and links the Lombardia regional school office. |

### Administrative-region evidence and postal disambiguation

- **São Paulo / New York:** the school-address sources explicitly provide SP and NY respectively; these are the Brazilian state and US state, not a transfer of the metropolitan city's name to another municipality.
- **Île-de-France:** [Onisep's official lycée record](https://www.onisep.fr/ressources/structures-enseignement/ile-de-france/val-de-marne/lycee-polyvalent-maximilien-perret) places Alfortville under Île-de-France / Val-de-Marne (HTTP 200). The actual school footer has 94140; the Onisep postal correspondence uses CEDEX 94142. The row does not use a postcode guard for this unambiguous municipality.
- **Małopolskie:** [Andrychów municipality's regional-programme notice](https://andrychow.eu/nabor-wnioskow-na-przekazanie-zbiornikow-na-deszczowke/) explicitly identifies its participation in a programme for municipalities of the Małopolskie voivodeship; full content was read through the web reader. Curl returned a bot-check page despite HTTP 200, so curl alone is not counted. [The voivodeship's official tourism portal](https://visitmalopolska.pl/web/visitmalopolska/punkty_informacji_turystycznej) also provided regional context through the web reader; curl was HTTP 403. The attempted administrative-act PDF returned HTTP 503 and was not treated as read evidence. Kraków uses the existing same regional label.
- **Nordrhein-Westfalen:** RWTH's official legal notice identifies the supervising ministry of North Rhine-Westphalia. [NRW-Stiftung's municipality list](https://www.nrw-stiftung.de/staedte-kreise-gemeinden.html) includes Aachen, Düsseldorf and Köln (HTTP 200). The state label is used consistently; all three actual cities remain distinct.
- **Galicia:** the Xunta school directory explicitly states Galicia. Official Turismo de Galicia pages for [Ferrol](https://www.turismo.gal/localizador-de-recursos/-/sit/que-visitar/ferrol?langId=es_ES) and [Arteixo](https://www.turismo.gal/localizador-de-recursos/-/sit/que-hacer/arteixo?langId=es_ES) returned HTTP 200 and corroborate both cities within the regional catalogue. A Coruña in company addresses can mean the province, which is why Inditex remains Arteixo and Inversa remains Ferrol.
- **Lombardia:** the school links USR Lombardia and the Milano territorial school office. [Abbiategrasso municipality's transport page](https://www.comune.abbiategrasso.mi.it/it/page/trasporti-taxi-e-trasporti-eccezionali) returned HTTP 200 and identifies applicable Lombardia regional transport services. The existing Milan rows retain the same region.

The US dataset contains **Albany 05820 (Vermont)** and **Accord 02018 (Massachusetts)**. Their names alone cannot justify New York records; neither was added. **Amsterdam 12010** matches both the bundled record and the official New York school address. Its row therefore adds `localityPostals: ["12010"]`; runtime matching must require the normalized profile postcode when this field is present. A missing or different postcode cannot establish New York through that row. No postcode was invented or copied from an unrelated city.

Additional rejected candidates: Coinscrap's homepage returned HTTP 503 and the web reader timed out; no company row was created. The ARMEDANGELS de-de guessed imprint returned HTTP 404; the de-at official imprint returned HTTP 200 and lists the German company address. The guessed auxmoney about page was HTTP 404; the successful official imprint/homepage establish the included record. A first curl batch encountered an HTTP-compressed response decoding error; checks were rerun with compressed decoding enabled, and the failed batch was not counted.

### Extension validation

A read-only check against the unchanged bundled place records passed all eight city/postal pairs above. For each there is a local school, a university in the same verified administrative region, and compatible model/crypto companies in that region. The final JSON has **55 unique IDs: 23 company, 17 university and 15 school records**. Required fields, company-role array structure and city/region consistency remain intact. The reserved unknown-city fixtures (Abadia dos Dourados, Aaronsburg, Aast, Abisynia, Aach, Abadía, Abano Terme, Bakewell) gained no sources or aliases.
