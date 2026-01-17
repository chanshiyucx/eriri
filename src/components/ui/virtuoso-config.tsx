import { forwardRef } from 'react'

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

const HorizontalList = forwardRef<HTMLDivElement>(
  function HorizontalList(props, ref) {
    return <div ref={ref} {...props} className="flex!" />
  },
)

export const LibraryPadding = {
  Header: LibraryHeader,
  Footer: LibraryFooter,
}

export const ReaderPadding = {
  Header: ReaderHeader,
  Footer: ReaderFooter,
}

export const ComicHorizontalList = {
  List: HorizontalList,
}
