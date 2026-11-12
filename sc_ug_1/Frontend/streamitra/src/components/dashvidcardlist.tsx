import { useMemo } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import VideoCard from '@components/dashvidcard';
import { parseVideoCards, type VideoCardData } from './parseVideoCards';

type Props = {
  /** Parsed JSON object/array, or raw JSON text. A `require`/`import` of a .json file works. */
  data: unknown;
  onPlay?: (card: VideoCardData, index: number) => void;
};

const GAP = 16;

/** More columns as the screen gets wider. */
function columnsFor(width: number) {
  if (width >= 1100) return 3;
  if (width >= 700) return 2;
  return 1;
}

export default function DashVidCardList({ data, onPlay }: Props) {
  const { width } = useWindowDimensions();
  const columns = columnsFor(width);
  const { cards, errors } = useMemo(() => parseVideoCards(data), [data]);

  // Split the cards into rows of `columns` cards each.
  const rows = useMemo(() => {
    const out: { key: string; items: { card: VideoCardData; index: number }[] }[] = [];
    for (let i = 0; i < cards.length; i += columns) {
      out.push({
        key: `row-${i}`,
        items: cards.slice(i, i + columns).map((card, j) => ({ card, index: i + j })),
      });
    }
    return out;
  }, [cards, columns]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
      contentContainerStyle={{ padding: GAP }}
      ListHeaderComponent={
        errors.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            {errors.map((message, i) => (
              <Text key={i} style={{ color: '#b3261e' }}>
                {message}
              </Text>
            ))}
          </View>
        ) : null
      }
      renderItem={({ item: row }) => (
        <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'flex-start' }}>
          {row.items.map(({ card: { id, ...props }, card, index }) => (
            <View key={id ?? index} style={{ flex: 1 }}>
              <VideoCard
                {...props}
                onPlay={onPlay ? () => onPlay(card, index) : undefined}
              />
            </View>
          ))}
          {/* Empty cells keep a short last row aligned to the grid */}
          {Array.from({ length: columns - row.items.length }, (_, i) => (
            <View key={`spacer-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      )}
    />
  );
}