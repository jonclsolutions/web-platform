<!--
  @file README.md
  @path src/app/apps/js-creator/admin/assets/README.md
  @project JS web-platform
  @author JS
  @created 2026
  @description Static files of JS Creator: the curated font set and the icon set. They are
  copied to `assets/apps/js-creator/admin/assets/` by the glob `*/admin/assets/**` of
  angular.json, so they leave together with the application.
-->

# JS Creator – fonts and icons

Everything here is served from the domain of the installation. Nothing is loaded from a CDN
(Google Fonts from their servers would send the IP address of every user to the USA – GDPR).

## `fonts/` – curated font set

| What | Value |
|---|---|
| Families | 25, listed in `fonts/fonts.json` (family, category, faces, files, source package) |
| Faces | weights 400 and 700 (normal); Bebas Neue and Anton 400 only |
| Files | WOFF2 of the subsets `latin` + `latin-ext` with their `unicode-range` – the browser loads only the subset a text needs |
| Source | the npm packages `@fontsource/<family>` (version in `fonts.json`) – the Google Fonts files, self-hosted |
| Licence | SIL Open Font License 1.1 – `fonts/<family>/OFL.txt` must stay next to the files |
| Czech | every face was checked to contain `ěščřžýáíéůúňťď` (upper and lower case) – Lato failed and was replaced by Fira Sans |

Adding a family: take the woff2 files of `latin` and `latin-ext` of the wanted weights from
`@fontsource/<family>`, copy its `LICENSE` as `OFL.txt` (only OFL / Apache 2.0 fonts), check the
Czech characters (e.g. with fontTools) and add the family to `fonts.json` with the
`unicode-range` of both subsets (`unicode.json` of the package).

## `icons/` – icon set

`icons/icons.json` holds 182 icons of [Lucide](https://lucide.dev) (`lucide-static`, version in the
file) as element lists (`path`, `circle`, `line`, `polyline`, `polygon`, `rect` with their
attributes, viewBox 0 0 24 24, stroke icons). Licence ISC – `icons/LICENSE.txt` must stay next to
the file. No logos of brands (social networks are trademarks): a user who may use one uploads it
to the library as an image.
