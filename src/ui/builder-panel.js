import { MAX_CITIES } from '../custom-state.js';

// Words for a share (in permille) and for the city lean, using the current matchup's side names.
export function describeShare(shareA, matchup) {
  return `${matchup.sideA.name} ${(shareA / 10).toFixed(1)}%`;
}

export function describeLean(cityLean, matchup) {
  if (cityLean === 0) return 'Cities lean neither side';
  return cityLean > 0 ? `Cities lean ${matchup.sideA.name} +${cityLean}` : `Cities lean ${matchup.sideB.name} +${-cityLean}`;
}

// The builder panel: how many cities there are, the two voter sliders, what happened last, and the buttons.
// It holds no state of its own; everything it shows comes from the plan it is given.
export function createBuilderPanel(root, {
  onShare, onLean, onPopulation, onPopulationCommit, onRemove, onUse, onCancel, onClear, onNewOutline,
} = {}) {
  const $ = (role) => root.querySelector(`[data-role="${role}"]`);
  const count = $('city-count');
  const message = $('build-message');
  const list = $('city-list');
  const use = $('build-use');
  const share = $('share-slider');
  const lean = $('lean-slider');
  const population = $('pop-slider');
  const populationOutput = $('pop-output');
  const remove = $('build-remove');

  share.addEventListener('input', () => onShare?.(Math.round(Number(share.value) * 10)));
  lean.addEventListener('input', () => onLean?.(Number(lean.value)));
  population.addEventListener('input', () => {
    showPopulation(Number(population.value));
    onPopulation?.(Number(population.value));
  });
  population.addEventListener('change', () => onPopulationCommit?.(Number(population.value)));
  remove.addEventListener('click', () => onRemove?.());
  $('build-use').addEventListener('click', () => onUse?.());
  $('build-cancel').addEventListener('click', () => onCancel?.());
  $('build-clear').addEventListener('click', () => onClear?.());
  $('build-outline').addEventListener('click', () => onNewOutline?.());

  function renderSlider(slider, output, label, value, labelText, outputText) {
    if (Number(slider.value) !== value) slider.value = String(value);
    label.textContent = labelText;
    output.textContent = outputText;
    slider.setAttribute('aria-valuetext', outputText);
  }

  // The label follows the slider as it moves, before the plan has caught up.
  let selectedNumber = null;
  function showPopulation(thousands) {
    const text = `City ${selectedNumber}: ${(thousands * 1000).toLocaleString('en-US')} voters`;
    populationOutput.textContent = text;
    population.setAttribute('aria-valuetext', text);
  }

  return {
    render({ plan, result, matchup, selected = null }) {
      count.textContent = `Cities: ${plan.cities.length} of ${MAX_CITIES}`;
      list.replaceChildren(...plan.cities.map((city, i) => {
        const item = document.createElement('li');
        item.textContent = `City ${i + 1} at x ${city.x}, y ${city.y}, ${city.pop.toLocaleString('en-US')} voters`;
        return item;
      }));
      const city = selected === null ? null : plan.cities[selected];
      selectedNumber = city ? selected + 1 : null;
      population.disabled = !city;
      remove.disabled = !city;
      if (city) {
        population.value = String(city.pop / 1000);
        showPopulation(city.pop / 1000);
      } else {
        population.value = '100';
        populationOutput.textContent = 'Place or select a city to set its population.';
        population.setAttribute('aria-valuetext', populationOutput.textContent);
      }
      renderSlider(share, $('share-output'), $('share-label'), plan.shareA / 10, `${matchup.sideA.name} share of all voters`, describeShare(plan.shareA, matchup));
      renderSlider(lean, $('lean-output'), $('lean-label'), plan.cityLean, 'City lean', describeLean(plan.cityLean, matchup));
      use.disabled = !result.ok;
    },
    // Writes to the visible message, which is also the live region screen readers announce.
    say(text) {
      message.textContent = text ?? '';
    },
  };
}
