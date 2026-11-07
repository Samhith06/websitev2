/**
 * What share of a milestone reward someone is paid, by what they wagered on.
 *
 * Shown beside the ladder rather than in small print, because the ladder prints
 * the full reward and these rates decide what actually arrives. Razed does not
 * report the split per game to this site, so it is checked by hand on the ticket
 * and nothing here works it out for the viewer.
 */
export function RewardRates({ monthly }: { monthly: boolean }) {
  return (
    <section className="rates" aria-labelledby="reward-rates-title">
      <div className="rates-head">
        <span className="eyebrow">Disclaimer</span>
        <h2 id="reward-rates-title">Milestone reward rates</h2>
      </div>

      <div className="rates-grid">
        <div className="rate full">
          <div className="rate-pct">100%</div>
          <div className="rate-name">Slots</div>
          <p>Wager on slots and you get the full milestone reward.</p>
        </div>

        <div className="rate half">
          <div className="rate-pct">50%</div>
          <div className="rate-name">Originals</div>
          <p>Wager on Originals and you get half of the milestone reward.</p>
        </div>

        <div className="rate full">
          <div className="rate-pct">100%</div>
          <div className="rate-name">Mixed, at least 60% slots</div>
          <p>
            If at least 60% of your wager{monthly ? ' in the month' : ''} is on slots, you can still
            claim the full reward, even with the other 40% on Originals or live games.
          </p>
        </div>
      </div>

      <p className="rates-note">
        Rewards on the ladder below are shown at the 100% rate. Your wager split is checked when you
        open a ticket, before the payout is sent.
      </p>
    </section>
  );
}
