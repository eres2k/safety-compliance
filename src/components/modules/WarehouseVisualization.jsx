import { useState, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'

/**
 * WarehouseVisualization - Interactive 2D warehouse floor plan
 * Click on objects to see relevant safety regulations
 */

// Localized UI labels
const UI_LABELS = {
  en: {
    title: 'Interactive Warehouse Floor Plan',
    subtitle: 'Click zones to explore safety regulations',
    safetyZones: 'Safety Zones',
    applicableRegs: 'Applicable Regulations',
    potentialHazards: 'Potential Hazards',
    requiredPPE: 'Required PPE',
    selectZone: 'Select a Zone',
    selectZoneDesc: 'Click or hover over any zone in the warehouse to see applicable safety regulations',
    quickAccess: 'Quick access',
    clickToView: 'Click on any zone to view safety regulations',
    noRegsForFramework: 'No regulations for this legal framework in this zone',
  },
  de: {
    title: 'Interaktiver Lagerhallenplan',
    subtitle: 'Klicken Sie auf Zonen, um Sicherheitsvorschriften zu erkunden',
    safetyZones: 'Sicherheitszonen',
    applicableRegs: 'Anwendbare Vorschriften',
    potentialHazards: 'Mögliche Gefahren',
    requiredPPE: 'Erforderliche PSA',
    selectZone: 'Zone auswählen',
    selectZoneDesc: 'Klicken oder fahren Sie über eine Zone, um die geltenden Sicherheitsvorschriften anzuzeigen',
    quickAccess: 'Schnellzugriff',
    clickToView: 'Klicken Sie auf eine Zone, um Sicherheitsvorschriften anzuzeigen',
    noRegsForFramework: 'Keine Vorschriften für diese Rechtsvorlage in dieser Zone',
  },
  nl: {
    title: 'Interactieve Magazijnplattegrond',
    subtitle: 'Klik op zones om veiligheidsvoorschriften te bekijken',
    safetyZones: 'Veiligheidszones',
    applicableRegs: 'Toepasselijke voorschriften',
    potentialHazards: 'Mogelijke gevaren',
    requiredPPE: 'Vereiste PBM',
    selectZone: 'Selecteer een zone',
    selectZoneDesc: 'Klik of beweeg over een zone om de geldende veiligheidsvoorschriften te bekijken',
    quickAccess: 'Snelle toegang',
    clickToView: 'Klik op een zone om veiligheidsvoorschriften te bekijken',
    noRegsForFramework: 'Geen voorschriften voor dit rechtskader in deze zone',
  },
}

// Framework options (used for flag display)
const FRAMEWORK_OPTIONS = {
  DE: { label: 'Germany', flag: '🇩🇪' },
  AT: { label: 'Austria', flag: '🇦🇹' },
  NL: { label: 'Netherlands', flag: '🇳🇱' },
}

// Localized zone data
const ZONE_LABELS = {
  loading_dock: { en: 'Loading Dock', de: 'Laderampe', nl: 'Laadperron' },
  forklift_area: { en: 'Forklift Traffic', de: 'Staplerverkehr', nl: 'Heftruckverkeer' },
  racking_storage: { en: 'Racking & Storage', de: 'Regallager', nl: 'Stellingopslag' },
  battery_charging: { en: 'Battery Charging', de: 'Batterieladestation', nl: 'Batterijladen' },
  conveyor_system: { en: 'Conveyor System', de: 'Fördersystem', nl: 'Transportsysteem' },
  packaging_station: { en: 'Packaging Station', de: 'Packstation', nl: 'Inpakstation' },
  hazmat_storage: { en: 'Hazmat Storage', de: 'Gefahrstofflager', nl: 'Gevaarlijke stoffen' },
  first_aid: { en: 'First Aid Station', de: 'Erste-Hilfe-Station', nl: 'EHBO-post' },
  emergency_exit: { en: 'Emergency Exit', de: 'Notausgang', nl: 'Nooduitgang' },
  fire_equipment: { en: 'Fire Equipment', de: 'Brandschutz', nl: 'Brandblussers' },
}

const ZONE_DESCRIPTIONS = {
  loading_dock: { en: 'Truck loading/unloading area', de: 'Be-/Entladebereich für LKW', nl: 'Vrachtwagen laad-/loszone' },
  forklift_area: { en: 'Forklift operation lanes', de: 'Gabelstaplerfahrspuren', nl: 'Heftruckrijbanen' },
  racking_storage: { en: 'High-bay racking system', de: 'Hochregallager', nl: 'Hoogbouwstellingen' },
  battery_charging: { en: 'Electric vehicle charging station', de: 'Ladestation für Elektrofahrzeuge', nl: 'Oplaadstation elektrische voertuigen' },
  conveyor_system: { en: 'Package sorting conveyors', de: 'Paketsortier-Förderbänder', nl: 'Pakketsorteer transportbanden' },
  packaging_station: { en: 'Manual packing workstations', de: 'Manuelle Verpackungsarbeitsplätze', nl: 'Handmatige inpakwerkplekken' },
  hazmat_storage: { en: 'Hazardous materials cabinet', de: 'Gefahrstoffschrank', nl: 'Gevaarlijke stoffenkast' },
  first_aid: { en: 'First aid and emergency equipment', de: 'Erste-Hilfe- und Notfallausrüstung', nl: 'EHBO en nooduitrusting' },
  emergency_exit: { en: 'Emergency evacuation routes', de: 'Notfall-Evakuierungswege', nl: 'Noodevacuatieroutes' },
  fire_equipment: { en: 'Fire extinguishers and suppression', de: 'Feuerlöscher und Löschanlagen', nl: 'Brandblussers en blussystemen' },
}

const HAZARDS = {
  loading_dock: {
    en: ['Vehicle collision', 'Falls from height', 'Crushing injuries', 'Manual handling'],
    de: ['Fahrzeugkollision', 'Absturz', 'Quetschverletzungen', 'Manuelle Handhabung'],
    nl: ['Voertuigbotsing', 'Vallen van hoogte', 'Kneuzingen', 'Handmatig tillen'],
  },
  forklift_area: {
    en: ['Vehicle collision', 'Pedestrian strikes', 'Tip-over', 'Load falls'],
    de: ['Fahrzeugkollision', 'Fußgängerunfälle', 'Umkippen', 'Lastabsturz'],
    nl: ['Voertuigbotsing', 'Voetgangersongevallen', 'Kantelen', 'Vallende lading'],
  },
  racking_storage: {
    en: ['Falling objects', 'Racking collapse', 'Overloading', 'Climbing falls'],
    de: ['Herabfallende Gegenstände', 'Regaleinsturz', 'Überladung', 'Absturz beim Klettern'],
    nl: ['Vallende voorwerpen', 'Instorten stellingen', 'Overbelasting', 'Vallen bij klimmen'],
  },
  battery_charging: {
    en: ['Hydrogen gas explosion', 'Acid burns', 'Electrical shock', 'Fire'],
    de: ['Wasserstoffgasexplosion', 'Säureverätzungen', 'Stromschlag', 'Brand'],
    nl: ['Waterstofgasexplosie', 'Zuurverbrandingen', 'Elektrische schok', 'Brand'],
  },
  conveyor_system: {
    en: ['Entanglement', 'Crushing', 'Shearing', 'Falling packages'],
    de: ['Einziehen', 'Quetschgefahr', 'Schergefahr', 'Herabfallende Pakete'],
    nl: ['Beknelling', 'Kneuzingen', 'Snijwonden', 'Vallende pakketten'],
  },
  packaging_station: {
    en: ['Repetitive strain', 'Back injuries', 'Cuts from tape/knives', 'Fatigue'],
    de: ['Repetitive Belastung', 'Rückenverletzungen', 'Schnitte', 'Ermüdung'],
    nl: ['RSI', 'Rugletsel', 'Snijwonden', 'Vermoeidheid'],
  },
  hazmat_storage: {
    en: ['Chemical exposure', 'Fire/explosion', 'Environmental spill', 'Toxic fumes'],
    de: ['Chemikalienexposition', 'Brand/Explosion', 'Umweltverschmutzung', 'Giftige Dämpfe'],
    nl: ['Blootstelling chemicaliën', 'Brand/explosie', 'Milieuverontreiniging', 'Giftige dampen'],
  },
  first_aid: {
    en: ['Delayed treatment', 'Infection', 'Improper care'],
    de: ['Verzögerte Behandlung', 'Infektion', 'Unsachgemäße Versorgung'],
    nl: ['Vertraagde behandeling', 'Infectie', 'Onjuiste verzorging'],
  },
  emergency_exit: {
    en: ['Blocked exit', 'Panic', 'Inadequate signage'],
    de: ['Blockierter Ausgang', 'Panik', 'Unzureichende Beschilderung'],
    nl: ['Geblokkeerde uitgang', 'Paniek', 'Onvoldoende bewegwijzering'],
  },
  fire_equipment: {
    en: ['Fire spread', 'Smoke inhalation', 'Wrong extinguisher type'],
    de: ['Brandausbreitung', 'Rauchvergiftung', 'Falscher Löscher'],
    nl: ['Brandverspreiding', 'Rookinhalatie', 'Verkeerde blusser'],
  },
}

const PPE_ITEMS = {
  loading_dock: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Yard Access Badge'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Sicherheitshandschuhe', 'Yard-Zugangsausweis'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Veiligheidshandschoenen', 'Yard-toegangsbadge'],
  },
  forklift_area: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Seat belt (forklift)'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Sicherheitshandschuhe', 'Sicherheitsgurt (Stapler)'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Veiligheidshandschoenen', 'Veiligheidsgordel (heftruck)'],
  },
  racking_storage: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Sicherheitshandschuhe'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Veiligheidshandschoenen'],
  },
  battery_charging: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Chemical gloves', 'Face shield', 'Safety glasses'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Chemikalienhandschuhe', 'Gesichtsschutz', 'Schutzbrille'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Chemische handschoenen', 'Gelaatsscherm', 'Veiligheidsbril'],
  },
  conveyor_system: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Fitted clothing'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Sicherheitshandschuhe', 'Anliegende Kleidung'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Veiligheidshandschoenen', 'Nauwsluitende kleding'],
  },
  packaging_station: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Anti-fatigue mat'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Sicherheitshandschuhe', 'Anti-Ermüdungsmatte'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Veiligheidshandschoenen', 'Anti-vermoeidheidsmat'],
  },
  hazmat_storage: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Chemical gloves', 'Respirator', 'Face shield'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Chemikalienhandschuhe', 'Atemschutz', 'Gesichtsschutz'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Chemische handschoenen', 'Ademhalingsapparaat', 'Gelaatsscherm'],
  },
  first_aid: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Disposable gloves'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Einweghandschuhe'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Wegwerphandschoenen'],
  },
  emergency_exit: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Evacuation training'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Evakuierungsschulung'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Evacuatietraining'],
  },
  fire_equipment: {
    en: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Fire extinguisher training'],
    de: ['Sicherheitsschuhe S3P', 'Sicherheitsweste (Warnweste)', 'Feuerlöscherschulung'],
    nl: ['Veiligheidsschoenen S3P', 'Veiligheidsvest (Reflecterend)', 'Brandblussertraining'],
  },
}

// Warehouse zones and their associated regulations
const WAREHOUSE_ZONES = {
  loading_dock: {
    id: 'loading_dock',
    label: 'Loading Dock',
    icon: '🚛',
    description: 'Truck loading/unloading area',
    regulations: [
      { abbr: 'DGUV Vorschrift 68', title: 'Forklifts and Industrial Trucks', country: 'DE' },
      { abbr: 'TRBS 2111', title: 'Mechanical Hazards - General', country: 'DE' },
      { abbr: 'ASchG §6', title: 'Work Equipment Requirements', country: 'AT' },
      { abbr: 'Arbobesluit Art. 7.4', title: 'Working at Height Provisions', country: 'NL' },
    ],
    hazards: ['Vehicle collision', 'Falls from height', 'Crushing injuries', 'Manual handling'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Yard Access Badge'],
  },
  forklift_area: {
    id: 'forklift_area',
    label: 'Forklift Traffic',
    icon: '🚜',
    description: 'Forklift operation lanes',
    regulations: [
      { abbr: 'DGUV Vorschrift 68', title: 'Forklifts and Industrial Trucks', country: 'DE' },
      { abbr: 'DGUV Information 208-033', title: 'Forklift Traffic', country: 'DE' },
      { abbr: 'AM-VO §32', title: 'Work Equipment Use', country: 'AT' },
      { abbr: 'AUVA M.plus 700', title: 'Forklift Safety Guidelines', country: 'AT' },
      { abbr: 'Arbobesluit Art. 7.17', title: 'Mobile Equipment', country: 'NL' },
      { abbr: 'Arbobesluit Art. 7.18', title: 'Self-propelled Work Equipment', country: 'NL' },
    ],
    hazards: ['Vehicle collision', 'Pedestrian strikes', 'Tip-over', 'Load falls'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Seat belt (forklift)'],
  },
  racking_storage: {
    id: 'racking_storage',
    label: 'Racking & Storage',
    icon: '📦',
    description: 'High-bay racking system',
    regulations: [
      { abbr: 'TRBS 2121', title: 'Danger of Falls from Height', country: 'DE' },
      { abbr: 'ASR A2.1', title: 'Protection against falls', country: 'DE' },
      { abbr: 'AM-VO §18', title: 'Storage and Stacking', country: 'AT' },
      { abbr: 'AUVA M.plus 801', title: 'Pallet Racking Safety', country: 'AT' },
      { abbr: 'Arbobesluit Art. 3.16', title: 'Storage Facilities', country: 'NL' },
      { abbr: 'Arbobesluit Art. 7.4', title: 'Working at Height', country: 'NL' },
    ],
    hazards: ['Falling objects', 'Racking collapse', 'Overloading', 'Climbing falls'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves'],
  },
  battery_charging: {
    id: 'battery_charging',
    label: 'Battery Charging',
    icon: '🔋',
    description: 'Electric vehicle charging station',
    regulations: [
      { abbr: 'TRBS 3151', title: 'Explosion Protection for Batteries', country: 'DE' },
      { abbr: 'VDE 0510', title: 'Battery Room Requirements', country: 'DE' },
      { abbr: 'TRGS 510', title: 'Hazardous Substance Storage', country: 'DE' },
      { abbr: 'ASchG §41', title: 'Fire Prevention', country: 'AT' },
      { abbr: 'AM-VO §35', title: 'Electrical Equipment', country: 'AT' },
      { abbr: 'Arbobesluit Art. 3.5', title: 'Explosion Safety', country: 'NL' },
      { abbr: 'PGS 37', title: 'Lithium Battery Storage', country: 'NL' },
    ],
    hazards: ['Hydrogen gas explosion', 'Acid burns', 'Electrical shock', 'Fire'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Chemical gloves', 'Face shield', 'Safety glasses'],
  },
  conveyor_system: {
    id: 'conveyor_system',
    label: 'Conveyor System',
    icon: '⚙️',
    description: 'Package sorting conveyors',
    regulations: [
      { abbr: 'TRBS 1111', title: 'Machinery Safety Requirements', country: 'DE' },
      { abbr: 'TRBS 2111', title: 'Mechanical Hazards', country: 'DE' },
      { abbr: 'AM-VO §33', title: 'Conveyor Systems', country: 'AT' },
      { abbr: 'Arbobesluit Art. 7.7', title: 'Machine Safety', country: 'NL' },
    ],
    hazards: ['Entanglement', 'Crushing', 'Shearing', 'Falling packages'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Fitted clothing'],
  },
  packaging_station: {
    id: 'packaging_station',
    label: 'Packaging Station',
    icon: '📋',
    description: 'Manual packing workstations',
    regulations: [
      { abbr: 'ArbStättV', title: 'Workplace Ordinance', country: 'DE' },
      { abbr: 'ASR A1.8', title: 'Traffic Routes', country: 'DE' },
      { abbr: 'AUVA IVSS', title: 'Manual Handling Guidelines', country: 'AT' },
      { abbr: 'TNO Fysieke Belasting', title: 'Physical Workload', country: 'NL' },
    ],
    hazards: ['Repetitive strain', 'Back injuries', 'Cuts from tape/knives', 'Fatigue'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Safety Gloves', 'Anti-fatigue mat'],
  },
  hazmat_storage: {
    id: 'hazmat_storage',
    label: 'Hazmat Storage',
    icon: '☣️',
    description: 'Hazardous materials cabinet',
    regulations: [
      { abbr: 'TRGS 510', title: 'Storage of Hazardous Substances', country: 'DE' },
      { abbr: 'TRGS 400', title: 'Risk Assessment Hazardous Substances', country: 'DE' },
      { abbr: 'GefStoffV', title: 'Hazardous Substances Ordinance', country: 'DE' },
      { abbr: 'ASchG §42', title: 'Hazardous Substances', country: 'AT' },
      { abbr: 'GKV', title: 'Grenzwerteverordnung', country: 'AT' },
      { abbr: 'PGS 15', title: 'Hazardous Storage Guidelines', country: 'NL' },
    ],
    hazards: ['Chemical exposure', 'Fire/explosion', 'Environmental spill', 'Toxic fumes'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Chemical gloves', 'Respirator', 'Face shield'],
  },
  first_aid: {
    id: 'first_aid',
    label: 'First Aid Station',
    icon: '🏥',
    description: 'First aid and emergency equipment',
    regulations: [
      { abbr: 'ASR A4.3', title: 'First Aid Rooms', country: 'DE' },
      { abbr: 'DGUV Vorschrift 1', title: 'Basic Accident Prevention', country: 'DE' },
      { abbr: 'ASchG §25', title: 'First Aid Requirements', country: 'AT' },
      { abbr: 'Arbowet Art. 15', title: 'First Aid Provisions', country: 'NL' },
    ],
    hazards: ['Delayed treatment', 'Infection', 'Improper care'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Disposable gloves'],
  },
  emergency_exit: {
    id: 'emergency_exit',
    label: 'Emergency Exit',
    icon: '🚪',
    description: 'Emergency evacuation routes',
    regulations: [
      { abbr: 'ASR A2.3', title: 'Escape Routes and Emergency Exits', country: 'DE' },
      { abbr: 'ASR A1.3', title: 'Safety Signage', country: 'DE' },
      { abbr: 'AStV §17', title: 'Emergency Exits', country: 'AT' },
      { abbr: 'Arbobesluit Art. 3.7', title: 'Escape Routes', country: 'NL' },
    ],
    hazards: ['Blocked exit', 'Panic', 'Inadequate signage'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Evacuation training'],
  },
  fire_equipment: {
    id: 'fire_equipment',
    label: 'Fire Equipment',
    icon: '🧯',
    description: 'Fire extinguishers and suppression',
    regulations: [
      { abbr: 'ASR A2.2', title: 'Fire Prevention Measures', country: 'DE' },
      { abbr: 'TRBS 3151', title: 'Fire and Explosion Prevention', country: 'DE' },
      { abbr: 'ASchG §25', title: 'Fire Safety Obligations', country: 'AT' },
      { abbr: 'Arbobesluit Art. 3.4', title: 'Fire Prevention', country: 'NL' },
    ],
    hazards: ['Fire spread', 'Smoke inhalation', 'Wrong extinguisher type'],
    ppe: ['Safety Shoes S3P', 'Safety Vest (High-Vis)', 'Fire extinguisher training'],
  },
}

// SVG Warehouse Layout - Generic 2D floor plan
const WarehouseSVG = ({ selectedZone, onZoneClick, onZoneHover }) => {
  const getZoneClass = (zoneId) => {
    const base = 'cursor-pointer transition-all duration-200'
    if (selectedZone === zoneId) {
      return `${base} opacity-100`
    }
    return `${base} opacity-70 hover:opacity-100`
  }

  return (
    <svg
      viewBox="0 0 800 500"
      className="w-full h-auto"
      style={{ minHeight: '400px' }}
    >
      {/* Background - Warehouse Floor */}
      <rect x="0" y="0" width="800" height="500" fill="#f3f4f6" className="dark:fill-gray-800" />

      {/* Grid pattern */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" className="dark:stroke-gray-700" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="800" height="500" fill="url(#grid)" />

      {/* Warehouse walls */}
      <rect x="20" y="20" width="760" height="460" fill="none" stroke="#6b7280" strokeWidth="4" className="dark:stroke-gray-500" />

      {/* Loading Dock - Top Left */}
      <g
        className={getZoneClass('loading_dock')}
        onClick={() => onZoneClick('loading_dock')}
        onMouseEnter={() => onZoneHover('loading_dock')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="30" y="30" width="180" height="100" rx="4" fill={selectedZone === 'loading_dock' ? '#f97316' : '#fbbf24'} fillOpacity="0.3" stroke={selectedZone === 'loading_dock' ? '#f97316' : '#d97706'} strokeWidth="2" />
        <text x="120" y="70" textAnchor="middle" className="text-lg font-bold fill-gray-800 dark:fill-gray-200">🚛</text>
        <text x="120" y="95" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Loading Dock</text>
        {/* Dock doors */}
        <rect x="40" y="30" width="30" height="15" fill="#6b7280" />
        <rect x="90" y="30" width="30" height="15" fill="#6b7280" />
        <rect x="140" y="30" width="30" height="15" fill="#6b7280" />
      </g>

      {/* Racking Storage - Center */}
      <g
        className={getZoneClass('racking_storage')}
        onClick={() => onZoneClick('racking_storage')}
        onMouseEnter={() => onZoneHover('racking_storage')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="240" y="80" width="320" height="180" rx="4" fill={selectedZone === 'racking_storage' ? '#f97316' : '#3b82f6'} fillOpacity="0.2" stroke={selectedZone === 'racking_storage' ? '#f97316' : '#2563eb'} strokeWidth="2" />
        <text x="400" y="130" textAnchor="middle" className="text-xl fill-gray-800 dark:fill-gray-200">📦</text>
        <text x="400" y="155" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Racking Storage</text>
        {/* Rack rows */}
        {[0, 1, 2, 3].map(i => (
          <rect key={i} x={260 + i * 75} y="170" width="60" height="80" fill="#94a3b8" fillOpacity="0.4" rx="2" />
        ))}
      </g>

      {/* Forklift Area - Main aisle */}
      <g
        className={getZoneClass('forklift_area')}
        onClick={() => onZoneClick('forklift_area')}
        onMouseEnter={() => onZoneHover('forklift_area')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="30" y="140" width="200" height="80" rx="4" fill={selectedZone === 'forklift_area' ? '#f97316' : '#22c55e'} fillOpacity="0.2" stroke={selectedZone === 'forklift_area' ? '#f97316' : '#16a34a'} strokeWidth="2" strokeDasharray="5,5" />
        <text x="130" y="175" textAnchor="middle" className="text-lg fill-gray-800 dark:fill-gray-200">🚜</text>
        <text x="130" y="200" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Forklift Traffic</text>
      </g>

      {/* Conveyor System - Right side */}
      <g
        className={getZoneClass('conveyor_system')}
        onClick={() => onZoneClick('conveyor_system')}
        onMouseEnter={() => onZoneHover('conveyor_system')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="580" y="80" width="180" height="200" rx="4" fill={selectedZone === 'conveyor_system' ? '#f97316' : '#8b5cf6'} fillOpacity="0.2" stroke={selectedZone === 'conveyor_system' ? '#f97316' : '#7c3aed'} strokeWidth="2" />
        <text x="670" y="140" textAnchor="middle" className="text-xl fill-gray-800 dark:fill-gray-200">⚙️</text>
        <text x="670" y="165" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Conveyor System</text>
        {/* Conveyor belt lines */}
        <line x1="600" y1="190" x2="740" y2="190" stroke="#6b7280" strokeWidth="3" />
        <line x1="600" y1="220" x2="740" y2="220" stroke="#6b7280" strokeWidth="3" />
        <line x1="600" y1="250" x2="740" y2="250" stroke="#6b7280" strokeWidth="3" />
      </g>

      {/* Packaging Station - Bottom left */}
      <g
        className={getZoneClass('packaging_station')}
        onClick={() => onZoneClick('packaging_station')}
        onMouseEnter={() => onZoneHover('packaging_station')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="30" y="300" width="200" height="100" rx="4" fill={selectedZone === 'packaging_station' ? '#f97316' : '#ec4899'} fillOpacity="0.2" stroke={selectedZone === 'packaging_station' ? '#f97316' : '#db2777'} strokeWidth="2" />
        <text x="130" y="340" textAnchor="middle" className="text-lg fill-gray-800 dark:fill-gray-200">📋</text>
        <text x="130" y="365" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Packaging Station</text>
        {/* Workstations */}
        {[0, 1, 2].map(i => (
          <rect key={i} x={50 + i * 60} y="370" width="40" height="20" fill="#94a3b8" fillOpacity="0.5" rx="2" />
        ))}
      </g>

      {/* Battery Charging - Bottom center */}
      <g
        className={getZoneClass('battery_charging')}
        onClick={() => onZoneClick('battery_charging')}
        onMouseEnter={() => onZoneHover('battery_charging')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="260" y="320" width="140" height="100" rx="4" fill={selectedZone === 'battery_charging' ? '#f97316' : '#14b8a6'} fillOpacity="0.2" stroke={selectedZone === 'battery_charging' ? '#f97316' : '#0d9488'} strokeWidth="2" />
        <text x="330" y="360" textAnchor="middle" className="text-xl fill-gray-800 dark:fill-gray-200">🔋</text>
        <text x="330" y="385" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Battery Charging</text>
        {/* Charging stations */}
        <circle cx="290" cy="400" r="8" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
        <circle cx="330" cy="400" r="8" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
        <circle cx="370" cy="400" r="8" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
      </g>

      {/* Hazmat Storage - Bottom right */}
      <g
        className={getZoneClass('hazmat_storage')}
        onClick={() => onZoneClick('hazmat_storage')}
        onMouseEnter={() => onZoneHover('hazmat_storage')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="420" y="320" width="140" height="100" rx="4" fill={selectedZone === 'hazmat_storage' ? '#f97316' : '#ef4444'} fillOpacity="0.2" stroke={selectedZone === 'hazmat_storage' ? '#f97316' : '#dc2626'} strokeWidth="2" />
        <text x="490" y="360" textAnchor="middle" className="text-xl fill-gray-800 dark:fill-gray-200">☣️</text>
        <text x="490" y="385" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Hazmat Storage</text>
        {/* Hazard diamond */}
        <polygon points="490,395 480,405 490,415 500,405" fill="#ef4444" />
      </g>

      {/* First Aid Station */}
      <g
        className={getZoneClass('first_aid')}
        onClick={() => onZoneClick('first_aid')}
        onMouseEnter={() => onZoneHover('first_aid')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="580" y="320" width="80" height="80" rx="4" fill={selectedZone === 'first_aid' ? '#f97316' : '#10b981'} fillOpacity="0.3" stroke={selectedZone === 'first_aid' ? '#f97316' : '#059669'} strokeWidth="2" />
        <text x="620" y="360" textAnchor="middle" className="text-xl fill-gray-800 dark:fill-gray-200">🏥</text>
        <text x="620" y="385" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">First Aid</text>
      </g>

      {/* Fire Equipment */}
      <g
        className={getZoneClass('fire_equipment')}
        onClick={() => onZoneClick('fire_equipment')}
        onMouseEnter={() => onZoneHover('fire_equipment')}
        onMouseLeave={() => onZoneHover(null)}
      >
        <rect x="680" y="320" width="80" height="80" rx="4" fill={selectedZone === 'fire_equipment' ? '#f97316' : '#f43f5e'} fillOpacity="0.3" stroke={selectedZone === 'fire_equipment' ? '#f97316' : '#e11d48'} strokeWidth="2" />
        <text x="720" y="360" textAnchor="middle" className="text-xl fill-gray-800 dark:fill-gray-200">🧯</text>
        <text x="720" y="385" textAnchor="middle" className="text-xs fill-gray-600 dark:fill-gray-400">Fire Equip</text>
      </g>

      {/* Emergency Exits - marked with arrows */}
      <g
        className={getZoneClass('emergency_exit')}
        onClick={() => onZoneClick('emergency_exit')}
        onMouseEnter={() => onZoneHover('emergency_exit')}
        onMouseLeave={() => onZoneHover(null)}
      >
        {/* Exit 1 - Left wall */}
        <rect x="20" y="420" width="10" height="40" fill={selectedZone === 'emergency_exit' ? '#f97316' : '#22c55e'} />
        <text x="40" y="445" className="text-sm fill-gray-800 dark:fill-gray-200">🚪</text>

        {/* Exit 2 - Right wall */}
        <rect x="770" y="420" width="10" height="40" fill={selectedZone === 'emergency_exit' ? '#f97316' : '#22c55e'} />
        <text x="750" y="445" textAnchor="end" className="text-sm fill-gray-800 dark:fill-gray-200">🚪</text>

        {/* Exit 3 - Bottom wall */}
        <rect x="380" y="470" width="40" height="10" fill={selectedZone === 'emergency_exit' ? '#f97316' : '#22c55e'} />
        <text x="400" y="465" textAnchor="middle" className="text-sm fill-gray-800 dark:fill-gray-200">🚪 EXIT</text>
      </g>

      {/* Legend */}
      <text x="40" y="480" className="text-xs fill-gray-500 dark:fill-gray-400">Click on any zone to view safety regulations</text>
    </svg>
  )
}

export function WarehouseVisualization({ onSelectRegulation }) {
  const { language, framework } = useApp()
  const lang = language || 'en'
  const l = UI_LABELS[lang] || UI_LABELS.en

  const [selectedZone, setSelectedZone] = useState(null)
  const [hoveredZone, setHoveredZone] = useState(null)

  // Get localized zone data
  const getZoneLabel = useCallback((zoneId) => ZONE_LABELS[zoneId]?.[lang] || ZONE_LABELS[zoneId]?.en || zoneId, [lang])
  const getZoneDescription = useCallback((zoneId) => ZONE_DESCRIPTIONS[zoneId]?.[lang] || ZONE_DESCRIPTIONS[zoneId]?.en || '', [lang])
  const getZoneHazards = useCallback((zoneId) => HAZARDS[zoneId]?.[lang] || HAZARDS[zoneId]?.en || [], [lang])
  const getZonePPE = useCallback((zoneId) => PPE_ITEMS[zoneId]?.[lang] || PPE_ITEMS[zoneId]?.en || [], [lang])

  const activeZone = useMemo(() => {
    const zoneId = selectedZone || hoveredZone
    return zoneId ? WAREHOUSE_ZONES[zoneId] : null
  }, [selectedZone, hoveredZone])

  // Filter regulations by selected framework (country)
  const filteredRegulations = useMemo(() => {
    if (!activeZone) return []
    return activeZone.regulations.filter(reg => reg.country === framework)
  }, [activeZone, framework])

  const handleZoneClick = useCallback((zoneId) => {
    setSelectedZone(zoneId === selectedZone ? null : zoneId)
  }, [selectedZone])

  const handleRegulationClick = useCallback((regulation) => {
    if (onSelectRegulation) {
      onSelectRegulation(regulation)
    }
  }, [onSelectRegulation])

  return (
    <div className="bg-white dark:bg-whs-dark-800 rounded-2xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-indigo-500 to-purple-600">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏭</span>
            <div>
              <h3 className="text-lg font-bold text-white">{l.title}</h3>
              <p className="text-sm text-indigo-200">{l.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Current Framework indicator */}
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <span className="text-lg">{FRAMEWORK_OPTIONS[framework]?.flag || '🌍'}</span>
              <span className="text-sm text-white font-medium">{FRAMEWORK_OPTIONS[framework]?.label || framework}</span>
            </div>
            <span className="hidden md:inline-block px-3 py-1 bg-white/20 rounded-lg text-sm text-white">
              {Object.keys(WAREHOUSE_ZONES).length} {l.safetyZones}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* SVG Warehouse */}
        <div className="flex-1 p-4 min-w-0">
          <WarehouseSVG
            selectedZone={selectedZone}
            onZoneClick={handleZoneClick}
            onZoneHover={setHoveredZone}
          />
        </div>

        {/* Info Panel */}
        <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900 p-4">
          {activeZone ? (
            <div className="space-y-4">
              {/* Zone Header */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeZone.icon}</span>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{getZoneLabel(activeZone.id)}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{getZoneDescription(activeZone.id)}</p>
                </div>
              </div>

              {/* Regulations - filtered by selected framework */}
              <div>
                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>📋</span> {l.applicableRegs}
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {FRAMEWORK_OPTIONS[framework]?.flag}
                  </span>
                </h5>
                <div className="space-y-2">
                  {filteredRegulations.length > 0 ? (
                    filteredRegulations.map((reg, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleRegulationClick(reg)}
                        className="w-full text-left p-2 rounded-lg bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 hover:border-whs-orange-500 dark:hover:border-whs-orange-500 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-whs-orange-600 dark:group-hover:text-whs-orange-400">
                            {reg.abbr}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-whs-dark-700 text-gray-500 dark:text-gray-400">
                            {reg.country === 'AT' ? '🇦🇹' : reg.country === 'DE' ? '🇩🇪' : '🇳🇱'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{reg.title}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
                      {l.noRegsForFramework}
                    </p>
                  )}
                </div>
              </div>

              {/* Hazards */}
              <div>
                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>⚠️</span> {l.potentialHazards}
                </h5>
                <div className="flex flex-wrap gap-1">
                  {getZoneHazards(activeZone.id).map((hazard, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    >
                      {hazard}
                    </span>
                  ))}
                </div>
              </div>

              {/* Required PPE */}
              <div>
                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>🦺</span> {l.requiredPPE}
                </h5>
                <div className="flex flex-wrap gap-1">
                  {getZonePPE(activeZone.id).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl mb-3 block">👆</span>
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">{l.selectZone}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {l.selectZoneDesc}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Zone Quick Access */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{l.quickAccess}:</span>
          {Object.values(WAREHOUSE_ZONES).map((zone) => (
            <button
              key={zone.id}
              onClick={() => handleZoneClick(zone.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors ${
                selectedZone === zone.id
                  ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300'
                  : 'bg-white dark:bg-whs-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-whs-dark-700'
              }`}
            >
              <span>{zone.icon}</span>
              <span className="hidden sm:inline">{getZoneLabel(zone.id)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WarehouseVisualization
