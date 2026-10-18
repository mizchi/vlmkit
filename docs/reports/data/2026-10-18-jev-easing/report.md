21 cases: 3 objects x 7 easings, 11 frames each. Model jev-1.14.0.

| arm | right | by easing (right of 3) |
|---|---:|---|
| frames | **7/21** | linear 3, ease 0, ease-in 1, ease-out 3, ease-in-out 0, steps 0, overshoot 0 |
| sheet | **4/21** | linear 3, ease 0, ease-in 0, ease-out 1, ease-in-out 0, steps 0, overshoot 0 |
| box | **21/21** | linear 3, ease 3, ease-in 3, ease-out 3, ease-in-out 3, steps 3, overshoot 3 |
| pixels | **21/21** | linear 3, ease 3, ease-in 3, ease-out 3, ease-in-out 3, steps 3, overshoot 3 |
| box, every 2nd frame (6) | 21/21 | same answers, subsampled |
| box, every 5th frame (3) | 14/21 | same answers, subsampled |

### frames: what each easing was named

| truth \ answer | linear | ease | ease-in | ease-out | ease-in-out | steps | overshoot |
|---|---:|---:|---:|---:|---:|---:|---:|
| linear | 3 |  |  |  |  |  |  |
| ease |  |  |  | 3 |  |  |  |
| ease-in | 2 |  | 1 |  |  |  |  |
| ease-out |  |  |  | 3 |  |  |  |
| ease-in-out | 2 |  | 1 |  |  |  |  |
| steps | 1 |  | 1 |  | 1 |  |  |
| overshoot |  |  |  | 3 |  |  |  |

### sheet: what each easing was named

| truth \ answer | linear | ease | ease-in | ease-out | ease-in-out | steps | overshoot |
|---|---:|---:|---:|---:|---:|---:|---:|
| linear | 3 |  |  |  |  |  |  |
| ease | 1 |  |  | 2 |  |  |  |
| ease-in | 3 |  |  |  |  |  |  |
| ease-out | 2 |  |  | 1 |  |  |  |
| ease-in-out | 2 |  |  | 1 |  |  |  |
| steps | 3 |  |  |  |  |  |  |
| overshoot | 1 |  |  | 2 |  |  |  |

### box: what each easing was named

| truth \ answer | linear | ease | ease-in | ease-out | ease-in-out | steps | overshoot |
|---|---:|---:|---:|---:|---:|---:|---:|
| linear | 3 |  |  |  |  |  |  |
| ease |  | 3 |  |  |  |  |  |
| ease-in |  |  | 3 |  |  |  |  |
| ease-out |  |  |  | 3 |  |  |  |
| ease-in-out |  |  |  |  | 3 |  |  |
| steps |  |  |  |  |  | 3 |  |
| overshoot |  |  |  |  |  |  | 3 |

- frames: median confidence right 0.30, wrong 0.51; median probability of the true easing 0.11
- sheet: median confidence right 0.81, wrong 0.61; median probability of the true easing 0.07
- box centre vs pixel centroid on the motion axis: median 2.6px, p90 5.9px, max 10.3px

| arm | requests | input tokens per case | $ per case | median latency |
|---|---:|---:|---:|---:|
| frames | 21 | 6879 | $0.00029 | 276ms |
| sheet | 21 | 2955 | $0.00012 | 163ms |
| box | 231 | 15378 | $0.00065 | 109ms |
