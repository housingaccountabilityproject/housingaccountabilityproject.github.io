#!/usr/bin/env python3
"""Read actual browser PDFs with MuPDF; no operating-system package install needed."""
import sys
import pymupdf
command,*args=sys.argv[1:]
if command=='pdftotext':
    assert len(args)==2 and args[1]=='-',args
    with pymupdf.open(args[0]) as document:
        for page in document:
            sys.stdout.write(page.get_text('text',sort=True)+'\f')
elif command=='pdfinfo':
    links=bool(args and args[0]=='-url')
    filename=args[1] if links else args[0]
    with pymupdf.open(filename) as document:
        if links:
            print('Page Type URL')
            for number,page in enumerate(document,1):
                for link in page.get_links():
                    if link.get('uri'):
                        print(number,'Annotation',link['uri'])
        else:
            print('Pages:',len(document))
else:
    raise ValueError('Unsupported PDF check: '+command)
