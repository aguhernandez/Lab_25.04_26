# Metabolic Lab JSON Export System

## Overview

The Asciende Metabolic Lab now automatically generates a complete, standardized JSON file after every metabolic test. This JSON contains all physiological data, calculations, and metadata required for integration with external systems, dashboards, and future analysis.

## Features

### Automatic Generation
- JSON is generated automatically after each test completion
- No manual intervention required
- Real-time validation and quality checks

### Complete Data Structure
Each JSON export includes:

1. **Athlete & Test Information**
   - Unique IDs for athlete and test
   - Test date, sport, and type
   - Complete anthropometry with source tracking (HUB/manual/mixed)

2. **Stage Data**
   - All raw measurements per stage:
     - Heart Rate (HR)
     - VO₂ (if measured)
     - Lactate (if measured)
     - RPE (Rate of Perceived Exertion)
     - Power/Speed (if available)
     - RER (Respiratory Exchange Ratio, if available)

3. **Calculated Metrics**
   - **VO₂max**: absolute (L/min), relative (ml/kg/min), and relative to lean body mass
   - **Thresholds**:
     - LT1 (Lactate Threshold 1): HR, VO₂, Power, percentages
     - LT2 (Lactate Threshold 2): HR, VO₂, Power, percentages
   - **FatMax**: HR, Power, VO₂ at maximum fat oxidation
   - **Training Zones**: 5 zones with HR, VO₂, and Power ranges

4. **Physiological Profile**
   - Aerobic capacity classification
   - Fat utilization efficiency
   - Anaerobic contribution
   - Durability assessment
   - Energy mix (fat vs carbohydrate %)

5. **Data Curves**
   - VO₂ progression across stages
   - Heart rate progression
   - Lactate curve
   - Fat oxidation curve
   - RPE progression
   - Power/RER curves (if available)

6. **Validation & Quality**
   - Data completeness check
   - Missing fields warnings
   - Quality score and assessment
   - Confidence flags for all calculations

7. **Metadata**
   - Generation timestamp
   - Lab version
   - Calculation engine version

## Confidence Flags

All calculated values include confidence levels:
- **measured**: Direct measurement from test equipment
- **estimated**: Calculated from related measurements (e.g., VO₂ from power)
- **inferred**: Default values based on demographics when data is unavailable

## Anthropometry Source Tracking

The system tracks data sources:
- **HUB**: Anthropometry pulled from Asciende HUB
- **manual**: Entered manually in Metabolic Lab
- **mixed**: Combination of both sources

Source information is:
- Clearly displayed in the dashboard
- Included in all JSON exports
- Color-coded in the UI (green=HUB, yellow=mixed, gray=manual)

## Usage

### Viewing JSON Summary
1. Complete a test and view results
2. Click "View JSON Summary" button
3. Review validation status and warnings
4. Check completeness and data quality

### Exporting JSON
1. Click "Export JSON" button on results page
2. JSON file downloads automatically
3. Filename format: `metabolic_test_[athleteName]_[testDate].json`

### JSON Structure Example

See `example-output.json` in the project root for a complete example with all fields populated.

## Integration

The exported JSON can be used for:
- External dashboard visualization
- Integration with Asciende HUB
- Historical analysis and trends
- Third-party performance tools
- Research and data analysis
- Coach/athlete reporting

## Data Quality Scoring

Tests receive quality scores based on:
- Number of stages (minimum 3 recommended)
- Direct VO₂ measurements (+4 points)
- Lactate measurements (+3 points)
- RER measurements (+2 points)
- Power measurements (+2 points)

**Quality Levels:**
- **Excellent** (10+ points): Direct metabolic measurements with lactate
- **Good** (7-9 points): Multiple direct measurements available
- **Fair** (4-6 points): Key metrics present, some estimation required
- **Basic** (<4 points): Primarily HR-based estimates

## Validation System

The JSON generator validates:
- Required anthropometry fields (weight, height, age)
- Minimum stage count (3+ recommended)
- Data completeness and consistency
- Calculation confidence levels

Warnings are issued for:
- Missing optional data (body fat %, lactate, power)
- Estimated vs measured values
- Incomplete data sets
- Below-threshold stage counts

## Future Enhancements

Planned features:
- JSON import for historical data
- Batch export for multiple tests
- Custom field selection
- API endpoint for automated integration
- Advanced filtering and querying
