const sceneScriptElement = document.getElementById('scene-script');
const loadAnimationCntnr = document.getElementById( 'load-animation' );
const tooltip = document.getElementById( 'tooltip' );
const tooltipName = tooltip.querySelector( '.name' );
const tooltipCategory = tooltip.querySelector( '.catgry' );
const fullscreenButton = document.getElementById( 'fs-toggle' );
const distanceReadoutValue = document.querySelector( '#distance-readout span.value' );
const distanceReadoutUnits = document.querySelector( '#distance-readout span.units' );
const nameReadout = document.getElementById( 'target-name');
const categoryReadout = document.querySelector( '#target-category' );
const orbitsReadout = document.querySelector( '#orbits-readout span.value' );
const referencePlaneReadout = document.querySelector( '#ref-plane-readout span.value' );
const referenceDirReadout = document.querySelector( '#ref-dir-readout span.value' );
const semiMajorReadoutValue = document.querySelector( '#a-readout span.value' );
const semiMajorReadoutUnits = document.querySelector( '#a-readout span.units' );
const eccentricityReadout = document.querySelector( '#e-readout span.value' );
const inclinationReadoutValue = document.querySelector( '#i-readout span.value' );
const inclinationReadoutUnits = document.querySelector( '#i-readout span.units' );
const ascendingNodeReadoutValue = document.querySelector( '#om-readout span.value' );
const ascendingNodeReadoutUnits = document.querySelector( '#om-readout span.units' );
const periArgumentReadoutValue = document.querySelector( '#w-readout span.value' );
const periArgumentReadoutUnits = document.querySelector( '#w-readout span.units' );
const trueAnomalyReadoutValue = document.querySelector( '#ta-readout span.value' );
const trueAnomalyReadoutUnits = document.querySelector( '#ta-readout span.units' );

export {
    sceneScriptElement,
    loadAnimationCntnr,
    tooltip,
    tooltipName,
    tooltipCategory,
    fullscreenButton,
    distanceReadoutValue,
    distanceReadoutUnits,
    nameReadout,
    categoryReadout,
    orbitsReadout,
    referencePlaneReadout,
    referenceDirReadout,
    semiMajorReadoutValue,
    semiMajorReadoutUnits,
    eccentricityReadout,
    inclinationReadoutValue,
    inclinationReadoutUnits,
    ascendingNodeReadoutValue,
    ascendingNodeReadoutUnits,
    periArgumentReadoutValue,
    periArgumentReadoutUnits,
    trueAnomalyReadoutValue,
    trueAnomalyReadoutUnits
}