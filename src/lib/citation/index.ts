/**
 * Citation System
 * Complete citation formatting and management for academic papers
 */

// Types
export type {
  CitationStyle,
  InTextFormat,
  PublicationType,
  CitationData,
  InTextOptions,
  CitationFormatter,
  StyleConfig,
} from './types';

export { CITATION_STYLES } from './types';

// Utilities
export {
  getLastName,
  getFirstName,
  toInitials,
  formatAuthorName,
  formatAuthorsInText,
  formatAuthorsReference,
  formatPages,
  formatDoi,
  formatUrl,
  formatVolumeIssue,
  formatTitle,
  toSentenceCase,
  toTitleCase,
  sortByAuthor,
  sortByAppearance,
  detectPublicationType,
} from './utils';

// Formatter
export {
  getFormatter,
  formatInText,
  formatInTextGroup,
  formatReference,
  formatReferenceList,
  paperToCitationData,
  citationToCitationData,
  createCitationMap,
  generateInTextRef,
  formatAllReferences,
  isNumericStyle,
  getSortOrder,
} from './formatter';

// Individual style formatters (for direct access if needed)
export { APAFormatter, apaFormatter } from './styles/apa';
export { MLAFormatter, mlaFormatter } from './styles/mla';
export { ChicagoFormatter, chicagoFormatter } from './styles/chicago';
export { IEEEFormatter, ieeeFormatter } from './styles/ieee';
export { GBT7714Formatter, gbt7714Formatter } from './styles/gbt7714';









