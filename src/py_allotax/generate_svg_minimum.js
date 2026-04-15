import fs from 'fs';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as d3 from 'd3';
import { combElems, rank_turbulence_divergence, diamond_count, wordShift_dat, balanceDat } from 'allotaxonometer-ui';
import { Dashboard } from 'allotaxonometer-ui/ssr';
import { render } from 'svelte/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHORT_TITLE_MAP = [
  ['How Compassion Made Us Human', [
    'how compassion made us human',
    'how compassion made us human the evolutionary origins of tenderness trust and moralit',
    'how compassion made us human the evolutionary origins of tenderness trust and morality'
  ]],
  ['Code Economy', [
    'code economy',
    'the code economy',
    'the code economy a forty thousand year history'
  ]],
  ['Dawn of Everything', [
    'dawn of everything',
    'the dawn of everything',
    'the dawn of everything a new history of humanity'
  ]],
  ['Ultrasociety', [
    'ultrasociety',
    'ultrasociety how 10000 years of war made humans the greatest cooperators on earth',
    'ultrasociety how 10 000 years of war made humans the greatest cooperators on earth'
  ]],
  ['Sapiens', [
    'sapiens',
    'sapiens a brief history of humankind'
  ]],
  ['humans3grams', ['humans 3grams', 'humans-3grams', 'humans3grams']],
  ['humans2grams', ['humans 2grams', 'humans-2grams', 'humans2grams']],
  ['humans', ['humans']],
  ['wikitext2-2grams', [
    'wikitext 2 raw v1 2grams',
    'wikitext-2-raw-v1-2grams',
    'wikitext2 2grams',
    'wikitext2-2grams'
  ]],
  ['wikitext103', [
    'wikitext 103 raw v1 1grams',
    'wikitext-103-raw-v1-1grams',
    'wikitext 103',
    'wikitext103'
  ]]
];

function normalizeDisplayTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function humanizeFallbackTitle(value) {
  return String(value ?? '')
    .replace(/\b(1grams|2grams|3grams)\b/gi, (_, ngrams) => ngrams.toLowerCase())
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortenDisplayTitle(value) {
  const normalized = normalizeDisplayTitle(value);

  for (const [shortLabel, aliases] of SHORT_TITLE_MAP) {
    if (aliases.some((alias) => normalized === alias || normalized.startsWith(alias))) {
      return shortLabel;
    }
  }

  const cleaned = String(value ?? '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? humanizeFallbackTitle(cleaned) : 'System';
}

function renderDashboard(props) {
  const result = render(Dashboard, { props });
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Allotaxonometer Dashboard</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, sans-serif;
    }
  </style>
</head>
<body>
  ${result.body}
</body>
</html>`;
}

function makeLogger(logPath) {
  return (message) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf8');
  };
}

function parseWordShiftLabel(label) {
  const match = String(label ?? '').match(/^(.*) \(([^()]+)\)$/);
  if (!match) {
    return {
      type: String(label ?? ''),
      rank1: null,
      rank2: null,
    };
  }

  const [, type, ranksText] = match;
  const rankMatch = ranksText.match(/^(.+)\s+⇋\s+(.+)$/);

  return {
    type,
    rank1: rankMatch ? Number(rankMatch[1]) : null,
    rank2: rankMatch ? Number(rankMatch[2]) : null,
  };
}

function computeRankTurbulenceDivergence(mixedelements, alpha, log) {
  const numericAlpha = Number(alpha);
  const ranks1 = mixedelements[0].ranks;
  const ranks2 = mixedelements[1].ranks;
  const counts1 = mixedelements[0].counts;
  const counts2 = mixedelements[1].counts;
  const length = ranks1.length;
  const divergenceElements = new Array(length);

  let positiveCount1 = 0;
  let positiveCount2 = 0;
  for (let i = 0; i < length; i++) {
    if (counts1[i] > 0) positiveCount1 += 1;
    if (counts2[i] > 0) positiveCount2 += 1;
  }

  let normalization = 0;
  const invR1Disjoint = 1 / (positiveCount2 + positiveCount1 / 2);
  const invR2Disjoint = 1 / (positiveCount1 + positiveCount2 / 2);

  if (!Number.isFinite(numericAlpha)) {
    for (let i = 0; i < length; i++) {
      const invR1 = 1 / ranks1[i];
      const invR2 = 1 / ranks2[i];
      const delta = ranks1[i] === ranks2[i] ? 0 : Math.max(invR1, invR2);
      divergenceElements[i] = delta;
      if (counts1[i] > 0) normalization += invR1;
      if (counts2[i] > 0) normalization += invR2;
    }
  } else if (numericAlpha === 0) {
    for (let i = 0; i < length; i++) {
      const rank1 = ranks1[i];
      const rank2 = ranks2[i];
      const maxRank = Math.max(rank1, rank2);
      const minRank = Math.min(rank1, rank2);
      divergenceElements[i] = Math.log10(maxRank / minRank);

      if (counts1[i] > 0) {
        normalization += Math.abs(Math.log((1 / rank1) / invR2Disjoint));
      }
      if (counts2[i] > 0) {
        normalization += Math.abs(Math.log((1 / rank2) / invR1Disjoint));
      }
    }
  } else {
    const prefactor = (numericAlpha + 1) / numericAlpha;
    const exponent = 1 / (numericAlpha + 1);
    const invR1DisjointPow = invR1Disjoint ** numericAlpha;
    const invR2DisjointPow = invR2Disjoint ** numericAlpha;

    for (let i = 0; i < length; i++) {
      const invR1 = 1 / ranks1[i];
      const invR2 = 1 / ranks2[i];
      const invR1Pow = invR1 ** numericAlpha;
      const invR2Pow = invR2 ** numericAlpha;
      divergenceElements[i] = prefactor * Math.abs(invR1Pow - invR2Pow) ** exponent;

      if (counts1[i] > 0) {
        normalization += prefactor * Math.abs(invR1Pow - invR2DisjointPow) ** exponent;
      }
      if (counts2[i] > 0) {
        normalization += prefactor * Math.abs(invR1DisjointPow - invR2Pow) ** exponent;
      }
    }
  }

  if (!Number.isFinite(normalization) || normalization === 0) {
    throw new Error(`Invalid RTD normalization: ${normalization}`);
  }

  log(`computed RTD via local loop implementation alpha=${numericAlpha}`);
  return {
    divergence_elements: divergenceElements.map((value) => value / normalization),
    normalization,
  };
}

(async () => {
  try {
    // Parse command line arguments
    const tempFilePath = process.argv[2];
    const outputPath = process.argv[3];
    const desiredFormat = process.argv[4] || 'pdf';
    const topN = process.argv[5] ? parseInt(process.argv[5]) : 30;
    
    if (!tempFilePath || !outputPath) {
      console.error('Usage: node generate_svg_minimum.js <temp_file> <output_file> [format] [top_n]');
      process.exit(1);
    }
    const logPath = `${outputPath}.progress.log`;
    fs.writeFileSync(logPath, '', 'utf8');
    const log = makeLogger(logPath);
    log(`start format=${desiredFormat} topN=${topN}`);
    
    // Load metadata from temp file
    const fullTempPath = resolve(__dirname, tempFilePath);
    
    if (!fs.existsSync(fullTempPath)) {
      console.error(`File not found: ${fullTempPath}`);
      process.exit(1);
    }
    
    const tempData = JSON.parse(fs.readFileSync(fullTempPath, 'utf8'));
    const {
      json_file_1: jsonFile1,
      json_file_2: jsonFile2,
      alpha,
      title1,
      title2
    } = tempData;
    log(`loaded temp metadata alpha=${alpha}`);
    const data1 = JSON.parse(fs.readFileSync(jsonFile1, 'utf8'));
    const data2 = JSON.parse(fs.readFileSync(jsonFile2, 'utf8'));
    log(`loaded json data sizes=${data1.length},${data2.length}`);
    
    console.log('Processing data...');
    
    // Process data with new API
    const me = combElems(data1, data2);
    log(`combined elements types=${me?.[0]?.types?.length ?? 'unknown'}`);
    const rtd = computeRankTurbulenceDivergence(me, alpha, log);
    log(`computed RTD normalization=${rtd?.normalization}`);
    
    // If RTD mode, return RTD + clean word data and exit early
    if (desiredFormat === 'rtd-json') {
      const dat = diamond_count(me, rtd);
      const allBarData = wordShift_dat(me, dat);
      const rawBarData = topN > 0 ? allBarData.slice(0, topN) : allBarData;
      
      // Clean up the barData format
      const cleanBarData = rawBarData.map((item) => {
        const parsed = parseWordShiftLabel(item.type);
        return {
          type: parsed.type,
          rank1: parsed.rank1,
          rank2: parsed.rank2,
          rank_diff: item.rank_diff,
          metric: item.metric
        };
      });
      
      const output = {
        rtd: rtd,
        barData: cleanBarData,
        total_words: allBarData.length
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`RTD + barData (${cleanBarData.length}/${allBarData.length} words) saved to ${outputPath}`);
      return;
    }
    
    // Continue with full processing for HTML/PDF
    const dat = diamond_count(me, rtd);
    log(`computed diamond counts=${dat?.counts?.length ?? 'unknown'}`);
    const diamond_dat = dat.counts;
    
    // Calculate derived values
    const maxRank1 = d3.max(me[0].ranks);
    const maxRank2 = d3.max(me[1].ranks);
    const maxlog10 = Math.ceil(Math.max(
      Math.log10(maxRank1),
      Math.log10(maxRank2)
    ));
    
    const max_count_log = Math.ceil(Math.log10(d3.max(diamond_dat, d => d.value))) + 1;

    // Generate chart data
    const barData = wordShift_dat(me, dat).slice(0, 30);
    log(`computed wordshift bars=${barData.length}`);
    const max_shift = d3.max(barData, d => Math.abs(d.metric));
    const balanceData = balanceDat(data1, data2);
    log(`computed balance data=${balanceData.length}`);
    const shortTitle1 = shortenDisplayTitle(title1);
    const shortTitle2 = shortenDisplayTitle(title2);
    
    console.log('Generating HTML...');
    log(`renderDashboard start titles=${shortTitle1}|${shortTitle2}`);
    
    const pdfWidth = 4200;
    const pdfHeight = 2970;

    // Generate HTML
    const html = renderDashboard({
      dat,
      alpha,
      divnorm: rtd.normalization,
      barData,
      balanceData,
      title: [shortTitle1, shortTitle2],
      maxlog10,
      max_count_log,
      width: pdfWidth,
      height: pdfHeight,
      DashboardWidth: pdfWidth,
      DashboardHeight: pdfHeight,
      marginInner: 160,
      marginDiamond: 40,
      xDomain: [-max_shift * 1.5, max_shift * 1.5],
      showDiamond: true,
      showWordshift: true,
      showDivergingBar: true,
      showLegend: true
    });
    log(`renderDashboard complete htmlLength=${html.length}`);
    
    // Handle HTML/PDF output
    if (desiredFormat === 'html') {
      fs.writeFileSync(outputPath, html);
      log(`wrote html ${outputPath}`);
      console.log(`HTML saved to ${outputPath}`);
    } else {
      // PDF (default)
      const htmlPath = outputPath.replace('.pdf', '.html');
      fs.writeFileSync(htmlPath, html);
      log(`wrote html companion ${htmlPath}`);
      console.log(`HTML saved to ${htmlPath}`);
      
      console.log('Launching browser...');
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      console.log('Generating PDF...');
      
      await page.pdf({
        path: outputPath,
        format: 'A3',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '40mm',
          left: '40mm'
        },
        scale: 1.0
      });
      
      await browser.close();
      log(`wrote pdf ${outputPath}`);
      console.log(`PDF successfully generated: ${outputPath}`);
    }
    
  } catch (error) {
    console.error('Error generating files:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
