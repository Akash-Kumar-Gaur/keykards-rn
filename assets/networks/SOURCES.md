# Network mark assets

Flat acceptance-style badges used by `NetworkBadge` via `src/components/vault/networkMarks.ts`.

| File | Network | Status | Source |
|---|---|---|---|
| `visa.svg` | Visa | **SVG mark** | [aaronfagan/svg-credit-card-payment-icons](https://github.com/aaronfagan/svg-credit-card-payment-icons) `flat/visa.svg` |
| `mastercard.svg` | Mastercard | **SVG mark** | same repo `flat/mastercard.svg` |
| `amex.svg` | Amex | **SVG mark** | same repo `flat/amex.svg` |
| `diners.svg` | Diners | **SVG mark** | same repo `flat/diners.svg` |
| — | RuPay | **Monogram fallback** | No public SVG in that set; NPCI brand kit not publicly downloadable here |

## Official brand kits (preferred for production licensing)

If you obtain licensed marks from the networks’ own kits, replace the files above
(or register PNGs in `networkAssets.ts`) and re-run:

```bash
node scripts/gen-network-marks.cjs
```

- Visa: https://brand.visa.com / https://globalclient.visa.com/brand-mark
- Mastercard: https://brand.mastercard.com / brandcenter download artwork
- Amex: American Express merchant / brand guidelines
- RuPay: NPCI RuPay brand center / guidelines PDF
- Diners: Discover Global Network brand assets

Trademarks remain owned by their respective networks; these marks are for
identifying accepted card networks in-app.
