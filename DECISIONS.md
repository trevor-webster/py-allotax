# Package decisions

## Decision
Regarding the ideation below, we ended up going with the following workflow using a mixed Python and JavaScript approach:
1. User provides 2 datasets and alpha.
1. In JS, create a DOM.
1. Load the allotaxonometer html plot template into the DOM.
1. Calculate data for the plot and add that data to each plot's svg.
1. Serialize results to a HTML.
1. Intercept this result in Python with `subprocess`.
1. Library saves the HTML to a file (user input can opt to end processing here).
1. Library generates a static image file from the HTML.


## Design

### Goals
1. Main goal: User accessibility for the use case of integrating the graphing method in computational research.
    - This goal means ease of ease of use and ease of installation into their environment.
1. Maintainability
    - It is easy to make updates to the code, hopefully from its main `npm` package.
    - One realism we're already dealing with is a custom branch of the main `allotaxonometer` library that enables minor customization to facilitate the Python integration.
1. Performance
    - The rendering and format conversion method runs headlessly; it should be able to handle large data sets and be integrated into larger analyses or many runs, pipelines, parallel processing, etc.

### Design thoughts considered
1. Write the package only in JavaScript.
    - Pro: we wouldn't need to manage disparate ecosystems (Python and JavaScript).
    - Con: this route doesn't as readily acheve goal 1, as we presume scientific users would need to install an unfamiliar ecosystem.
1. Write the package in Python (while utilizing the `npm` library).
    - Pro: achieves goal 1 of ease of use
    - Con: may make goal 1 of ease of installation still difficult. We will perform early user testing to see how much of a barrier this is--noting this is an early version of the tool.
    - Add-on options to consider:
        1. Include any node.js library binaries in the Python library to negate a `npm` and `node.js` environment for users (assumption: ease of installation comes from Python installation being the only dependency). The difficulty with this route is that binaries for multiple OSs should be included.
            - **We want to attempt this route first to abstract away JS ecosystem.**
        1. Make a set-up/install script so the user does not need to worry about the installation of `node`, `npm`, and packages.
1. Containerize `py-allotax` to manage the environment.
    - Pro: this would make the environment easy and consistent across all users. Users would only need to worry about a Docker installation.
    - Con: user testing needed for accessibility goal; also unclear how much maintainability would be affected while the py-allotax's `allotaxonometer` library remains a branch of the main library.

 ### HTML to image options

 See [this issue](https://github.com/carterwward/py-allotax/issues/3) for details on options explored so far.

## Future improvements (TODOs):
1. Continue improving the ecosystem dependencies (or automation of set-up) to streamline ease of installation.
1. Extend methods:
    - ability to get computed ranks and other variables of interest (data that is generated for the creation of the graph but not returned anywhere).
    - ability to retrieve intermediate desired results to analyze or visualize in other tools.
1. Write up some examples, including a use case for big data using multiprocessing locally.
1. Improve or add more HTML to image conversion method(s).

## Text cleaning decisions

Downloaded `.txt` books used for corpus preparation are cleaned with targeted deterministic rules rather than whole-file encoding repair.

These files are treated as downloaded text exports/conversions with possible extraction artifacts. The cleaning rationale does not depend on a specific upstream tool such as `epub2txt`; the same rules apply whether the corruption came from EPUB export, PDF-to-text conversion, OCR post-processing, site-side text export, browser copy/paste, or another intermediate encoding/conversion step.

### Rules
1. Normalize common mojibake punctuation to simple ASCII equivalents before cleanup:
   - apostrophes like `???` -> `'`
   - quotes like `???` / `???` -> `"`
   - dashes like `???` / `???` -> `-`
   - ellipses like `???` -> `...`
   - broken spaces like `???` and non-breaking spaces -> normal spaces
1. Keep punctuation only when it appears inside a token:
   - `.` for `\w+\.\w+`
   - `,` for `\w+,\w+`, including numbers like `40,000`
   - `-` for `\w+-\w+`
   - `'` for `\w+'\w+`
1. Replace all other punctuation with spaces.
1. Preserve valid Unicode letters and diacritics that are already correct, such as `Del?ge`, `Neuch?tel`, `Pal?orient`, and `M?ori`.
1. Remove repeated standalone title/header lines after the first kept occurrence when the cleaner is given an explicit title.
1. Remove obvious layout junk such as separator lines (`* * *`), isolated roman-numeral page markers, and isolated `Q` lines from extracted front matter.
1. Normalize whitespace after cleanup by collapsing repeated spaces, trimming line edges, and collapsing 3+ blank lines to 2.
1. Do not perform intelligent lexical inference or context-based word repair during cleaning.
   - Example: if a bad conversion step has already produced `codeprograms`, the cleaner does not guess that it should become `code programs`.
   - Reason: those guesses are not deterministic and can introduce false corrections at scale.

### Rejected approach
1. Do not apply broad cp1252/latin1-to-utf8 recoding across the whole document.
   - This was tested and made some downloaded texts less readable by merging word boundaries and removing legitimate apostrophes.
1. Do not use heuristic or LLM-style word-boundary reconstruction inside the cleaner.
   - If a corpus contains merged words or other semantic corruption with no easy deterministic rule, those cases should be corrected manually or by a separate explicitly heuristic workflow, not by the default cleaner.
