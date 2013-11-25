#!/c/devel/perl/bin/perl -w
################################################################################
#
# SCRIPT: closure.pl
#
#     Wrapper for the Google Closure Compiler (a Java-based JavaScript minifier).
#
#     Author   :  Thomas Michael Edwards <tmedwards@motoslave.net>
#     Copyright:  Copyright © 2011–2013 Thomas Michael Edwards. All rights reserved.
#     Version  :  r07, 2013-11-25
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
use Getopt::Long qw(:config no_getopt_compat no_gnu_compat no_ignore_case);	#see: http://perldoc.perl.org/Getopt/Long.html

# setup
binmode(STDOUT, ':encoding(Windows-1252)');	# for messages
binmode(STDERR, ':encoding(Windows-1252)');	# for errors
$| = 1;										# set autoflush

# globals
my @CLOSURECMD = ('C:\\Program Files\\Java\\jre7\\bin\\java.exe', '-jar', 'C:\\devel\\local\\closure\\compiler.jar');

# prototypes
sub runClosure(@);


################################################################################
#
# COMMAND LINE PROCESSING
#
################################################################################

sub usage(;$)
{
	my $verbose	= shift();
	my $short	= 'Usage: closure.pl [options] infile [... infileN]';
	my $long	= <<EndLong;
$short

  infile                    Input file name(s).

Options:
  -c <charset>, --charset=<charset>  Set input and output charset.
  -E3, --ecmascript3                 Set language to ECMAScript 3.
  -E5, --ecmascript5                 Set language to ECMAScript 5. (default)
  -E5s, --ecmascript5strict          Set language to ECMAScript 5 strict.
  -Fd, --format-delim                Format output by printing input delimiters.
  -Fp, --format-pretty               Format output by pretty printing.
  -Fq, --format-quotes               Format output by printing single quotes.
  -h, --help                         Print this help, then exit.
  -H                                 Print Closure\'s help, then exit.
  -O                                 Set optimization level to 2.
  -O<number>                         Set optimization level to <number>.
                                       1: Optimize by removing whitespace only.
                                       2: Perform safe optimizations. (default)
                                       3: Perform unsafe optimizations.
  -o <file>, --outfile=<file>        Set output file; defaults to name of first
                                       input file plus '-min'.
  -Wall, --warn-all                  Enable all warning messages.
  -w, --warn-none                    Suppress warning messages.
EndLong

	$verbose = 0 if (!defined($verbose));
	print "\n", $verbose ? $long : $short, "\n";
}

# check command line arguments
my $opt_outfile			= '';
my $opt_charset			= '';
my $opt_formating		= 0;
my $opt_language		= 2;
my $opt_optimization	= 2;
my $opt_warnings		= 2;
GetOptions
(
	'charset=s'				=> \$opt_charset,
	'ecmascript3|E3'		=> sub { $opt_language = 1 },
	'ecmascript5|E5'		=> sub { $opt_language = 2 },
	'ecmascript5strict|E5s'	=> sub { $opt_language = 3 },
	'format-delim|Fd'		=> sub { $opt_formating = 2 },
	'format-pretty|Fp'		=> sub { $opt_formating = 1 },
	'format-quotes|Fq'		=> sub { $opt_formating = 3 },
	'O1'					=> sub { $opt_optimization = 1 },
	'O2|O'					=> sub { $opt_optimization = 2 },
	'O3'					=> sub { $opt_optimization = 3 },
	'outfile=s'				=> \$opt_outfile,
	'warn-all|Wall'			=> sub { $opt_warnings = 3 },
	'warn-none|w'			=> sub { $opt_warnings = 1 },
	'H'						=> sub { runClosure('--help') and exit(0) },
	'help|?'				=> sub { usage(1) and exit(0) },
) or exit(1);
usage() and exit(1) unless (@ARGV > 0);

# get the input filenames and naked closure options
my @opt_infiles = grep { m/^[^-]/ } @ARGV;
my @opt_naked   = grep { m/^-/ } @ARGV;

# set the output filename, if necessary
if (!$opt_outfile)
{
	$opt_outfile = $opt_infiles[0];
	$opt_outfile =~ s/(\.\w+)?$/.min$1/;
}

# run closure
my @gcOpts	= ('WHITESPACE_ONLY', 'SIMPLE_OPTIMIZATIONS', 'ADVANCED_OPTIMIZATIONS');
my @gcFmts	= ('PRETTY_PRINT', 'PRINT_INPUT_DELIMITER', 'SINGLE_QUOTES');
my @gcLang	= ('ECMASCRIPT3', 'ECMASCRIPT5', 'ECMASCRIPT5_STRICT');
my @gcWarn	= ('QUIET', 'DEFAULT', 'VERBOSE');
my @gcArgs	= ();
push(@gcArgs, '--charset', $opt_charset)								if ($opt_charset);
push(@gcArgs, '--compilation_level', $gcOpts[$opt_optimization - 1]);
push(@gcArgs, '--formatting', $gcFmts[$opt_formating - 1])				if ($opt_formating);
push(@gcArgs, '--language_in', $gcLang[$opt_language - 1]);
push(@gcArgs, '--warning_level', $gcWarn[$opt_warnings - 1]);
push(@gcArgs, '--js_output_file', $opt_outfile)							if ($opt_outfile and $opt_outfile ne '-');
push(@gcArgs, map { ('--js', $_) } @opt_infiles)						if (@opt_infiles);
push(@gcArgs, @opt_naked)												if (@opt_naked);
runClosure(@gcArgs);

# done
exit(0);


################################################################################
#
# UTIL FUNCTIONS
#
################################################################################

sub runClosure(@)
{
	my @args = @CLOSURECMD;
	push(@args, @_);
	system(@args);
}


################################################################################
__END__
################################################################################

