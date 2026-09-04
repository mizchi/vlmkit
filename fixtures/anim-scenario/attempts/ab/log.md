# Round 1: Initial Predictions

## Expected Behavior

### Search for 70
The tree after inserting sorted [10, 20, 30, 40, 50, 60, 70] forms a degenerate right-only chain:
```
10
  20
    30
      40
        50
          60
            70
```

Searching for 70 should require 7 comparisons:
1. 70 > 10: go right to 20
2. 70 > 20: go right to 30
3. 70 > 30: go right to 40
4. 70 > 40: go right to 50
5. 70 > 50: go right to 60
6. 70 > 60: go right to 70
7. 70 == 70: found

### Where 35 and 45 Land
After search for 70, inserting 35:
- 35 > 10: go right to 20
- 35 > 20: go right to 30
- 35 > 30: go right to 40
- 35 < 40: go left → becomes LEFT CHILD OF 40

Inserting 45:
- 45 > 10: go right to 20
- 45 > 20: go right to 30
- 45 > 30: go right to 40
- 45 > 40: go right to 50
- 45 < 50: go left → becomes LEFT CHILD OF 50

## First Attempt Output

(Will update after running check)
