function LibraryHeader() {
  return <div className="h-4" />
}

function LibraryFooter() {
  return <div className="h-4" />
}

function ReaderHeader() {
  return <div className="h-16" />
}

function ReaderFooter() {
  return <div className="h-32" />
}

export const LibraryPadding = {
  Header: LibraryHeader,
  Footer: LibraryFooter,
}

export const ReaderPadding = {
  Header: ReaderHeader,
  Footer: ReaderFooter,
}
