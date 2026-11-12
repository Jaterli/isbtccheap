"""Pruebas del zigzag de build_analysis (python test_zigzag.py, o con pytest)."""
import build_analysis as ba

# Velas diarias reales de BTCUSDT del 20 de octubre al 11 de noviembre de 2026: (máximo, mínimo, cierre)
DAYS = ["10-20", "10-21", "10-22", "10-23", "10-24", "10-25", "10-26", "10-27", "10-28", "10-29", "10-30", "10-31",
        "11-01", "11-02", "11-03", "11-04", "11-05", "11-06", "11-07", "11-08", "11-09", "11-10", "11-11"]
HLC = [(83439, 81200, 83028), (84898, 82635, 84093), (84377, 80940, 81416), (82061, 80513, 81189), (81214, 79221, 80888),
       (81034, 79846, 80154), (80845, 79369, 80151), (81300, 79506, 80910), (81823, 80397, 81344), (81971, 77910, 77992),
       (78804, 76326, 77369), (77796, 77114, 77582), (78422, 77517, 78354), (78878, 76705, 76816), (78063, 76389, 77454),
       (81196, 75736, 80504), (80918, 75208, 76088), (76416, 74888, 75844), (76250, 75571, 75868), (76200, 73510, 74851),
       (75599, 73750, 75368), (75442, 72727, 73796), (74811, 73209, 74015)]
THRESHOLD = 4490  # 2 ATR diarios el 11 de noviembre


def pivots():
    high, low, close = ([c[k] for c in HLC] for k in range(3))
    piv, current = ba._zigzag(high, low, close, THRESHOLD)
    return [(DAYS[i], kind, level) for i, kind, level in piv], (DAYS[current[0]], current[1], current[2])


def test_outside_candle_gives_both_pivots():
    """El 4 de noviembre perforó el mínimo y subió 5.460 $ cerrando arriba: mínimo y máximo, en ese orden."""
    piv, current = pivots()
    assert piv == [("10-21", "high", 84898), ("11-04", "low", 75736), ("11-04", "high", 81196)]
    assert current == ("11-10", "low", 72727)


def test_small_bounce_is_not_a_pivot():
    """El rebote del 29 de octubre (2.750 $ desde 79.221 $) no llega al umbral: no es estructura del diario."""
    piv, _ = pivots()
    assert not any(day == "10-29" for day, _, _ in piv)


if __name__ == "__main__":
    test_outside_candle_gives_both_pivots()
    test_small_bounce_is_not_a_pivot()
    print("ok")
