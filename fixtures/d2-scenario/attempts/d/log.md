# Round Log

## Round 1
- Changed: Initial D2 structure with 3 regions (outside, edge, cluster), services, datastores, broker
- Issue: Width 112 cols (exceeds 100); broken stripe self-loop; unclear region separation
- Width: 112

## Round 2
- Changed: Removed self-loop, shortened labels (Orders->Orders, Inventory->Inventory, etc), added direction:down to cluster
- Result: Width 94 cols (within limit); layout improved but some visual confusion from cross-region connections
- Width: 94

## Round 3
- Changed: Moved connections outside containers, shortened more IDs (gw, db, cache)
- Result: Width 115 (worse); excessive duplication of boxes
- Width: 115

## Round 4
- Changed: Reverted to Round 2 structure (best so far)
- Result: Width 94, readable despite stripe appearing in both cluster and outside regions
- Width: 94

## Round 5
- Changed: Used underscore reference `billing -> _.stripe` to reference stripe outside cluster container
- Result: Width 94; stripe duplication resolved; cross-region connection now clearly shown as arrow leaving cluster. d2 validate/fmt pass; render exit 0; can trace all connections
- Width: 94
- Exit codes: fmt=0, validate=0, text render=0, ascii render=0, svg render=0
