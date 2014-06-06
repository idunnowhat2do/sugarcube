import header
from collections import OrderedDict

class Header (header.Header):

	def filesToEmbed(self):
		return OrderedDict()

	def storySettings(self):
		return "SugarCube does not support the StorySettings special passage.\n\nInstead, you should use SugarCube's configuration object, config.\n    See: http://www.motoslave.net/sugarcube/docs/#config"

	def isEndTag(self, name, tag):
		return (name == ('/' + tag) or name == ('end' + tag))

	def nestedMacros(self):
		return [
				# standard macros
				'if',
				'for',
				'silently',
				'nobr',
				'script',
				'click',
				'button',
				'append',
				'prepend',
				'replace',
				'widget',
				'optiontoggle',
				'optionlist'
				# deprecated macros
				# (none, yay)
			]

	def passageTitleColor(self, passage):
		additionalSpecialPassages = [
				'MenuOptions',
				'MenuShare',
				'MenuStory',
				'PassageDone',
				'PassageReady',
				'StoryBanner',
				'StoryCaption'
			]
		if passage.isStylesheet():
			return ((111, 49, 83), (234, 123, 184))
		elif passage.isScript():
			return ((89, 66, 28), (226, 170, 80))
		elif ('widget' in passage.tags):
			return ((80, 106, 26), (134, 178, 44))
		elif passage.isInfoPassage() or (passage.title in additionalSpecialPassages):
			return ((28, 89, 74), (41, 214, 113))
		elif passage.title == 'Start':
			return ('#4ca333', '#4bdb24')

	def passageChecks(self):
		return super(Header, self).passageChecks()

