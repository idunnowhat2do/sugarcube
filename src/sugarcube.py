import header
from collections import OrderedDict

class Header (header.Header):

	def filesToEmbed(self):
		return OrderedDict()

	def storySettings(self):
		return []

	def isEndTag(self, name, tag):
		return (name == ('/' + tag) or name == ('end' + tag))

	def nestedMacros(self):
		return [
				# standard macros
				  'if'
				, 'silently'
				, 'nobr'
				, 'script'
				, 'click'
				, 'button'
				, 'append'
				, 'prepend'
				, 'replace'
				, 'widget'
				, 'optiontoggle'
				, 'optionlist'
				# deprecated macros
				, 'bind'
				, 'class'
				, 'id'
				, 'update'
			]

	def passageChecks(self):
		return super(Header, self).passageChecks()

