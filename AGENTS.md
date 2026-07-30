# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Display principle — facts only

KeyKards is a **secure card vault**, not an analytics or estimation product.

Show **facts**:
- What the user entered
- What a real transaction, email, or statement states
- What a card’s listed benefits plainly state (title / description / literal bank terms)

Do **not** show:
- Invented or LLM-estimated rupee figures (`value_estimate` projections, “potential earn”, fee-payback %)
- Numbers that only exist after assuming typical policy or annualizing without an explicit annual statement
- A “Listed · est.” (or similar) confidence label on a number — if it needs that label, **hide the number** and show the underlying descriptive fact instead

If a feature is only useful by inventing a number, don’t ship that part — show the underlying fact and let the user conclude.
