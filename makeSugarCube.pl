#!/c/devel/perl/bin/perl -w
################################################################################
#
# SCRIPT: makeSugarCube.pl
#
#     Build SugarCube (a header for Twine/Twee).
#
#     Author   :  Thomas Michael Edwards <tmedwards@motoslave.net>
#     Copyright:  Copyright © 2013 Thomas Michael Edwards. All rights reserved.
#     Version  :  r11, 2013-09-25
#
################################################################################

################################################################################
#
# CONFIGURATION
#
################################################################################

# configuration & module loading
require 5.010_000;							# require Perl >= v5.10.0
use strict;
use warnings;
use utf8;
use File::Basename qw(fileparse);
use File::Path qw(make_path);
use Getopt::Long qw(:config no_getopt_compat no_gnu_compat no_ignore_case);	#see: http://perldoc.perl.org/Getopt/Long.html

# setup
binmode(STDOUT, ':encoding(Windows-1252)');	# for messages
binmode(STDERR, ':encoding(Windows-1252)');	# for errors
$| = 1;										# set autoflush

# globals
my %CONFIG		=
(
	'template'	=> 'src/header.tmpl',
	'js'		=> ['src/polyfills.js', 'src/utility.js', 'src/main.js', 'src/story.js', 'src/macros.js', 'src/wikifier.js'],
	'css'		=> 'src/styles.css',
	'build'		=> '.build'
);
my $outfile		= 'dist/header.html';
my $outdir;
my $outfh;

# prototypes


################################################################################
#
# COMMAND LINE PROCESSING
#
################################################################################

sub usage(;$)
{
	my $verbose	= shift();
	my $short	= 'Usage: makeSugarCube.pl [options] [outfile]';
	my $long	= << "END_LONG";
$short

  outfile                   Optional output file name.

Options:
  -d, --debug               Keep debugging code; implies -u.
  -h, --help                Print this help, then exit.
  -u, --unminified          Suppress minification stages.
END_LONG

	$verbose = 0 if (!defined($verbose));
	print "\n", $verbose ? $long : $short, "\n";
	exit($verbose ? 0 : 1);
}

# check command line arguments
my $opt_debug			= 0;
my $opt_minify			= 1;
GetOptions
(
	'debug'				=> sub { $opt_debug = 1, $opt_minify = 0 },
	'unminified'		=> sub { $opt_minify = 0 },
	'help|?'			=> sub { usage(1) },
) or exit(1);
usage(0) if (@ARGV > 1);
chomp($outfile = shift(@ARGV)) if (@ARGV == 1);	# get the output file name, if one was supplied
($_, $outdir, $_) = fileparse($outfile);


################################################################################
#
# HEADER BUILDING
#
################################################################################

my $infh;

# load the header template
open($infh, '<:encoding(UTF-8)', $CONFIG{'template'})	# auto decode on read
	or die("error: cannot open header template (\"$CONFIG{'template'}\") for reading\n");
my $template = do { local $/; <$infh> };
close($infh);

# load and combine the scripts
my $scripts = '';
foreach my $srcfile (@{$CONFIG{'js'}})
{
	if (!-f $srcfile)
	{
		warn("warning: source file (\"$srcfile\") does not exist\n");
		next;
	}
	open($infh, '<:encoding(UTF-8)', $srcfile)	# auto decode on read
		or die("error: cannot open script file (\"$srcfile\") for reading\n");
	my $script = '';
	foreach my $line (<$infh>)
	{
		next if (!$opt_debug and $line =~ m/console\.log/);
		$script .= $line;
	}
	close($infh);
	$scripts .= $script;
}
if ($opt_minify)
{
	# write the tmpfile
	my $tmpfile = ".tmp.makeSugarCube.$$";
	open(my $tmpfh, '>:encoding(UTF-8)', $tmpfile)	# auto encode on write
		or die("error: cannot open temporary file (\"$tmpfile\") for writing\n");
	print $tmpfh $scripts;
	close($tmpfh);

	my $pipecmd = join ' ',
	(
		'closure.pl',
		'-w',
		#'-c UTF-8',
		'-o -',
		'"'.$tmpfile.'"'
	);
	open($infh, '-|:encoding(UTF-8)', $pipecmd)	# auto decode on read
		or die("error: cannot open scripts pipe from closure.pl for reading\n");
	my $pipeout = do { local $/; <$infh> };
	$pipeout =~ tr/\r\n//d;	# required for closure
	close($infh);
	unlink($tmpfile)	if (-f $tmpfile);
	$scripts = $pipeout;
}
if (!$opt_debug)
{
	# wrap the scripts in an anonymous function
	$scripts =
		';(function () {'
		. ($opt_minify ? $scripts : "\n" . $scripts . "\n")
		. '}());';
}

# load the styles
open($infh, '<:encoding(UTF-8)', $CONFIG{'css'})	# auto decode on read
	or die("error: cannot open styles file (\"$CONFIG{'css'}\") for reading\n");
my $styles = do { local $/; <$infh> };
close($infh);

# load the build info
open($infh, '+<:encoding(UTF-8)', $CONFIG{'build'})	# auto decode on read
	or die("error: cannot open build info file (\"$CONFIG{'build'}\") for reading\n");
my $build = 1 + do { local $/; <$infh> };
seek($infh, 0, 0);
print $infh $build;
close($infh);

# process the header template
$template =~ s/\[\(\$VERSION\)\]/$build/g;
$template =~ s/\[\(\$SCRIPTS\)\]/$scripts/g;
$template =~ s/\[\(\$STYLES\)\]/$styles/g;

# write the outfile
make_path($outdir) if (!-d $outdir);
open($outfh, '>:encoding(UTF-8)', $outfile)	# auto encode on write
	or die("error: cannot open output file (\"$outfile\") for writing\n");
print $outfh $template;
close($outfh);


################################################################################
__END__
################################################################################
