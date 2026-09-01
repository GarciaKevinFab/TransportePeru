// Tire schema helpers: axle-config parsing, position-code generation and
// render-config building. Identifiers in English, UI strings in Spanish.
//
// POSITION CODE RULES (deterministic & stable so mounted tires are never lost):
//   prefix = 'T' (tracto) | 'C' (carreta)
//   For axle index i (1-based, only non-spare axles are counted) and side L/R:
//     - balón (dual:false): `${prefix}-${i}${side}`            -> "T-1L", "T-1R"
//     - dual  (dual:true) : `${prefix}-${i}${side}1/2`         -> "T-2L1","T-2L2","T-2R1","T-2R2"
//     - repuesto          : `${prefix}-SP` (or `${prefix}-SP2`, `-SP3` ...)
//
// IMPORTANT: vehicles WITHOUT `axle_config` keep the EXACT legacy codes defined
// in the FALLBACK configs below (letters like "C-A-L"). The numeric rule only
// applies once the user configures `axle_config` for a vehicle.

export const AXLE_TYPES = ['direccional', 'traccion', 'muerto', 'levantable'];

// Visual convention per axle type (the colored axle bar + legend).
export const AXLE_TYPE_META = {
  direccional: { label: 'Direccional', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  traccion: { label: 'Tracción', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  muerto: { label: 'Muerto', bar: 'bg-grafito-400', dot: 'bg-grafito-400' },
  levantable: { label: 'Levantable', bar: 'bg-blue-500', dot: 'bg-blue-500' },
};

const prefixFor = (vehicleType) => (vehicleType === 'tracto' ? 'T' : 'C');

// Build left/right position arrays for a generated (numeric) axle.
export function axlePositions(prefix, index, dual) {
  if (dual) {
    return {
      left: [
        { code: `${prefix}-${index}L1`, label: `${index}L1` },
        { code: `${prefix}-${index}L2`, label: `${index}L2` },
      ],
      right: [
        { code: `${prefix}-${index}R1`, label: `${index}R1` },
        { code: `${prefix}-${index}R2`, label: `${index}R2` },
      ],
    };
  }
  return {
    left: [{ code: `${prefix}-${index}L`, label: `${index}L` }],
    right: [{ code: `${prefix}-${index}R`, label: `${index}R` }],
  };
}

// ── Legacy fallback configs (EXACT codes/labels as before, now normalized to the
// { axles:[{name,type,dual,left,right}], spare:[...] } shape used by the renderer).
export const TRACTO_FALLBACK = {
  axles: [
    {
      name: 'Eje Direccional',
      type: 'direccional',
      dual: false,
      left: [{ code: 'T-1L', label: '1L' }],
      right: [{ code: 'T-1R', label: '1R' }],
    },
    {
      name: 'Eje Tracción',
      type: 'traccion',
      dual: true,
      left: [
        { code: 'T-2L1', label: '2L1' },
        { code: 'T-2L2', label: '2L2' },
      ],
      right: [
        { code: 'T-2R1', label: '2R1' },
        { code: 'T-2R2', label: '2R2' },
      ],
    },
  ],
  spare: [{ code: 'T-SP', label: 'Repuesto' }],
};

export const CARRETA_FALLBACK = {
  axles: [
    {
      name: 'Eje A',
      type: 'muerto',
      dual: false,
      left: [{ code: 'C-A-L', label: 'AL' }],
      right: [{ code: 'C-A-R', label: 'AR' }],
    },
    {
      name: 'Eje B',
      type: 'muerto',
      dual: false,
      left: [{ code: 'C-B-L', label: 'BL' }],
      right: [{ code: 'C-B-R', label: 'BR' }],
    },
    {
      name: 'Eje C',
      type: 'muerto',
      dual: false,
      left: [{ code: 'C-C-L', label: 'CL' }],
      right: [{ code: 'C-C-R', label: 'CR' }],
    },
  ],
  spare: [{ code: 'C-SP', label: 'Repuesto' }],
};

// Build a render-config from a persisted axle_config array.
// Contract of each element: { name, type, dual, is_spare }
export function buildConfigFromAxleConfig(axleConfig, vehicleType) {
  const prefix = prefixFor(vehicleType);
  const axles = [];
  const spare = [];
  let axleIndex = 0;
  let spareIndex = 0;

  axleConfig.forEach((a, i) => {
    if (a?.is_spare) {
      spareIndex += 1;
      const code = spareIndex === 1 ? `${prefix}-SP` : `${prefix}-SP${spareIndex}`;
      spare.push({
        code,
        label: spareIndex === 1 ? 'Repuesto' : `Repuesto ${spareIndex}`,
      });
    } else {
      axleIndex += 1;
      const { left, right } = axlePositions(prefix, axleIndex, !!a?.dual);
      axles.push({
        name: a?.name || `Eje ${axleIndex}`,
        type: AXLE_TYPES.includes(a?.type) ? a.type : 'traccion',
        dual: !!a?.dual,
        left,
        right,
      });
    }
  });

  return { axles, spare };
}

// Choose which render-config to use for a vehicle.
export function getRenderConfig(vehicle) {
  if (Array.isArray(vehicle?.axle_config) && vehicle.axle_config.length > 0) {
    return buildConfigFromAxleConfig(vehicle.axle_config, vehicle.vehicle_type);
  }
  return vehicle?.vehicle_type === 'tracto' ? TRACTO_FALLBACK : CARRETA_FALLBACK;
}

// Derive the editable axle_config array (contract shape) from a vehicle, so the
// config dialog opens pre-populated even for vehicles that never saved one.
export function deriveAxleConfig(vehicle) {
  if (Array.isArray(vehicle?.axle_config) && vehicle.axle_config.length > 0) {
    return vehicle.axle_config.map((a) => ({
      name: a?.name || '',
      type: AXLE_TYPES.includes(a?.type) ? a.type : 'traccion',
      dual: !!a?.dual,
      is_spare: !!a?.is_spare,
    }));
  }
  const cfg = vehicle?.vehicle_type === 'tracto' ? TRACTO_FALLBACK : CARRETA_FALLBACK;
  const axles = cfg.axles.map((a) => ({
    name: a.name,
    type: a.type,
    dual: a.dual,
    is_spare: false,
  }));
  const spares = (cfg.spare || []).map((s) => ({
    name: s.label,
    type: 'muerto',
    dual: false,
    is_spare: true,
  }));
  return [...axles, ...spares];
}
