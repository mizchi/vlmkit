/**
 * What a story file looks like. Copy to `src/components/Button.story.tsx`
 * (drop `.template`); each named export becomes one story id:
 *
 *   components/Button/Primary
 *   components/Button/Disabled
 *   components/Button/WithTitle
 *   components/Button/CountsClicks
 */
import { useState } from "react";
import { Button } from "./Button";

export const Primary = () => <Button title="Submit" />;
export const Disabled = () => <Button title="Submit" disabled />;

/**
 * Props come from the test / CLI: `mount('components/Button/WithTitle', { title })`
 * or `check story components/Button/WithTitle --props '{"title":"Hello"}'`.
 * Default them so the story renders on its own too — `check story` without
 * `--props` still has to produce a baseline.
 */
export const WithTitle = ({ title = "Default" }: { title?: string }) => <Button title={title} />;

/**
 * The hidden-form pattern, and the reason stories exist at all.
 *
 * The old CT packages let a test pass a callback inline (`onClick={() => ++clicks}`)
 * because they compiled JSX in the test file — which is what "kept the packages
 * experimental forever". Props now cross into the browser as plain serializable
 * data, so callbacks cannot. The story owns the state instead and records it into
 * a hidden form for the test to assert on:
 *
 *   const component = await mount('components/Button/CountsClicks');
 *   await component.getByRole('button').click();
 *   await expect(component.getByTestId('click-count')).toHaveValue('1');
 *
 * For VRT this matters differently: a story that renders its own state is a
 * story `check story` can screenshot in that state, with no test to drive it.
 */
export const CountsClicks = () => {
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <Button title="Submit" onClick={() => setClicks((n) => n + 1)} />
      <form hidden>
        <input data-testid="click-count" readOnly value={String(clicks)} />
      </form>
    </>
  );
};
