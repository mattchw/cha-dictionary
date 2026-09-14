// Words too common to bother linking in definitions.
const STOPWORDS = new Set([
  "about", "above", "across", "after", "again", "against", "all", "almost",
  "along", "also", "although", "always", "among", "and", "another", "any",
  "anyone", "anything", "are", "around", "as", "at", "away", "back", "be",
  "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "cannot", "could", "did", "do", "does", "doing", "done",
  "down", "during", "each", "either", "else", "enough", "even", "ever",
  "every", "everyone", "everything", "few", "first", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "however", "if", "in", "into", "is", "it",
  "its", "itself", "just", "last", "like", "made", "make", "makes", "many",
  "may", "might", "more", "most", "much", "must", "my", "myself", "need",
  "never", "no", "nor", "not", "nothing", "now", "of", "off", "often", "on",
  "once", "one", "only", "onto", "or", "other", "others", "our", "ours",
  "ourselves", "out", "over", "own", "same", "shall", "she", "should", "so",
  "some", "someone", "something", "sometimes", "still", "such", "than",
  "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "though", "through", "to", "too", "two",
  "under", "until", "up", "upon", "us", "used", "using", "very", "was",
  "we", "well", "were", "what", "when", "where", "whether", "which", "while",
  "who", "whom", "whose", "why", "will", "with", "within", "without", "would",
  "you", "your", "yours", "yourself", "yourselves",
]);
export function normalizeLookupWord(token: string): string {
  return token
    .toLowerCase()
    .replace(/(?:'s|'re|'ve|'ll|'d|'m)$/i, "")
    .replace(/[^a-z]/g, "");
}

export function isLinkableToken(token: string, headword: string): boolean {
  const word = normalizeLookupWord(token);
  if (word.length < 5) return false;
  if (word === headword.toLowerCase()) return false;
  if (STOPWORDS.has(word)) return false;
  return /^[a-z]+(?:'[a-z]+)?$/i.test(token);
}

export function splitLinkableText(text: string): string[] {
  return text.split(/(\b[a-z]+(?:'[a-z]+)?\b)/gi);
}
